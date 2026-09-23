import { prisma } from "@/lib/db";
import { getUser, hasRole } from "@/lib/auth";
import { NextResponse } from "next/server";
import { imagekit } from "@/lib/imagekit";

export async function PATCH(req, { params }) {
    try {
        const user = await getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const requestIds = id.split(",").map(i => parseInt(i)).filter(i => !isNaN(i));

        const body = await req.json().catch(() => ({}));
        const { deleteFileIds, overrideBudget } = body;

        if (requestIds.length === 0) {
            return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
        }

        const requests = await prisma.paymentRequest.findMany({
            where: { id: { in: requestIds } }
        });

        if (requests.length === 0) {
            return NextResponse.json({ error: "Requests not found" }, { status: 404 });
        }

        // ── PROJECT MANAGER path ─────────────────────────────────────────────────
        if (hasRole(user, "PROJECT_MANAGER")) {
            if (requests.some(r => r.status !== "PENDING_PM")) {
                return NextResponse.json({ error: "One or more requests have invalid status for Manager approval" }, { status: 400 });
            }

            // Budget Validation
            const projectId = requests[0].project_id;
            const project = await prisma.project.findUnique({ where: { id: projectId } });

            if (project?.budget) {
                const currentApprovedRequests = await prisma.paymentRequest.aggregate({
                    where: {
                        project_id: projectId,
                        status: { in: ["PENDING_ADMIN", "APPROVED", "PAID"] }
                    },
                    _sum: { total_amount: true }
                });

                const currentApprovedSum = currentApprovedRequests._sum.total_amount
                    ? parseFloat(currentApprovedRequests._sum.total_amount) : 0;
                const approvingSum = requests.reduce((sum, r) => sum + parseFloat(r.total_amount), 0);

                if (currentApprovedSum + approvingSum > parseFloat(project.budget) && !overrideBudget) {
                    return NextResponse.json({
                        error: "BUDGET_EXCEEDED",
                        message: "Approving these requests will exceed the project's allocated budget.",
                        allocatedBudget: parseFloat(project.budget),
                        currentExpenses: currentApprovedSum,
                        approvingAmount: approvingSum,
                        remainingBudget: parseFloat(project.budget) - currentApprovedSum,
                        amountExceeded: (currentApprovedSum + approvingSum) - parseFloat(project.budget)
                    }, { status: 409 });
                }
            }

            await prisma.paymentRequest.updateMany({
                where: { id: { in: requestIds } },
                data: { status: "PENDING_ADMIN", pm_id: user.id }
            });

            return NextResponse.json({ success: true, requestIds, newStatus: "PENDING_ADMIN", bypassedIds: [] });

        // ── SUPER ADMIN path ─────────────────────────────────────────────────────
        } else if (hasRole(user, "SUPER_ADMIN")) {
            // SA can approve PENDING_ADMIN (normal flow) and PENDING_PM (direct bypass)
            const invalidRequests = requests.filter(
                r => r.status !== "PENDING_ADMIN" && r.status !== "PENDING_PM"
            );
            if (invalidRequests.length > 0) {
                return NextResponse.json({
                    error: "One or more requests have invalid status for Admin approval",
                    invalidIds: invalidRequests.map(r => r.id),
                    invalidStatuses: [...new Set(invalidRequests.map(r => r.status))]
                }, { status: 400 });
            }

            const pendingPMRequests = requests.filter(r => r.status === "PENDING_PM");
            const pendingAdminRequests = requests.filter(r => r.status === "PENDING_ADMIN");

            // ── Budget Validation (bypass path only) ──────────────────────────────
            if (pendingPMRequests.length > 0 && !overrideBudget) {
                const projectId = pendingPMRequests[0].project_id;
                const project = await prisma.project.findUnique({ where: { id: projectId } });

                if (project?.budget) {
                    const currentCommitted = await prisma.paymentRequest.aggregate({
                        where: {
                            project_id: projectId,
                            status: { in: ["PENDING_ADMIN", "APPROVED", "PAID"] }
                        },
                        _sum: { total_amount: true }
                    });
                    const committedSum = currentCommitted._sum.total_amount
                        ? parseFloat(currentCommitted._sum.total_amount) : 0;
                    const bypassingSum = pendingPMRequests.reduce(
                        (sum, r) => sum + parseFloat(r.total_amount), 0
                    );
                    if (committedSum + bypassingSum > parseFloat(project.budget)) {
                        return NextResponse.json({
                            error: "BUDGET_EXCEEDED",
                            message: "Directly approving these requests will exceed the project's allocated budget.",
                            allocatedBudget: parseFloat(project.budget),
                            currentExpenses: committedSum,
                            approvingAmount: bypassingSum,
                            remainingBudget: parseFloat(project.budget) - committedSum,
                            amountExceeded: (committedSum + bypassingSum) - parseFloat(project.budget)
                        }, { status: 409 });
                    }
                }
            }

            // ── Selective image deletion (unchanged — applies to all SA approvals) ─
            if (Array.isArray(deleteFileIds) && deleteFileIds.length > 0) {
                try {
                    await Promise.allSettled(deleteFileIds.map(fileId => imagekit.deleteFile(fileId)));
                    await prisma.material.updateMany({
                        where: {
                            request_id: { in: requestIds },
                            image_file_id: { in: deleteFileIds }
                        },
                        data: { image_url: null, image_file_id: null }
                    });
                    console.log(`Selective deletion: ${deleteFileIds.length} images deleted and cleared.`);
                } catch (ikError) {
                    console.error("Selective deletion error:", ikError);
                    // Continue with approval even if deletion fails
                }
            }

            // ── Atomic transaction: update two subsets separately ─────────────────
            await prisma.$transaction(async (tx) => {
                // Normal flow: PENDING_ADMIN → APPROVED (pm_id already set by Manager, leave unchanged)
                if (pendingAdminRequests.length > 0) {
                    await tx.paymentRequest.updateMany({
                        where: { id: { in: pendingAdminRequests.map(r => r.id) } },
                        data: { status: "APPROVED" }
                    });
                }
                // Bypass flow: PENDING_PM → APPROVED (SA acted as Manager — record audit fields)
                if (pendingPMRequests.length > 0) {
                    await tx.paymentRequest.updateMany({
                        where: { id: { in: pendingPMRequests.map(r => r.id) } },
                        data: { status: "APPROVED", pm_id: user.id, pm_bypassed: true }
                    });
                }
            });

            return NextResponse.json({
                success: true,
                requestIds,
                newStatus: "APPROVED",
                // Tells the client which IDs were bypass-approved (for toast differentiation)
                bypassedIds: pendingPMRequests.map(r => r.id)
            });

        } else {
            return NextResponse.json({ error: "Unauthorized role" }, { status: 401 });
        }
    } catch (error) {
        console.error("Approve request error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
