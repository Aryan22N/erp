import { prisma } from "@/lib/db";
import { getUser, hasRole } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function PATCH(req, { params }) {
    try {
        const user = await getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!hasRole(user, "PROJECT_MANAGER")) {
            return NextResponse.json({ error: "Unauthorized role" }, { status: 403 });
        }

        const { id } = await params;
        const requestId = parseInt(id);
        if (isNaN(requestId)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const body = await req.json().catch(() => ({}));
        const { approvedMaterialIds = [], rejectedMaterialIds = [] } = body;

        // At least one item must have an explicit decision
        if (approvedMaterialIds.length === 0 && rejectedMaterialIds.length === 0) {
            return NextResponse.json({ error: "No material decisions provided" }, { status: 400 });
        }

        const originalRequest = await prisma.paymentRequest.findUnique({
            where: { id: requestId },
            include: { materials: true }
        });

        if (!originalRequest) {
            return NextResponse.json({ error: "Request not found" }, { status: 404 });
        }

        if (originalRequest.status !== "PENDING_PM") {
            return NextResponse.json({ error: "Request is not PENDING_PM" }, { status: 400 });
        }

        const allMaterials = originalRequest.materials;
        const approvedIds = approvedMaterialIds.map(Number);
        const rejectedIds = rejectedMaterialIds.map(Number);

        // Materials with NO decision → stay PENDING_PM
        const pendingMaterials = allMaterials.filter(
            m => !approvedIds.includes(m.id) && !rejectedIds.includes(m.id)
        );
        const approvedMaterials = allMaterials.filter(m => approvedIds.includes(m.id));
        const rejectedMaterials = allMaterials.filter(m => rejectedIds.includes(m.id));

        // ── Simple cases (no splitting needed) ──────────────────────────
        // All approved, nothing pending or rejected
        if (approvedIds.length === allMaterials.length) {
            await prisma.paymentRequest.update({
                where: { id: requestId },
                data: { status: "PENDING_ADMIN", pm_id: user.id }
            });
            return NextResponse.json({ success: true, action: "full_approve" });
        }

        // All rejected, nothing pending or approved
        if (rejectedIds.length === allMaterials.length) {
            await prisma.paymentRequest.update({
                where: { id: requestId },
                data: { status: "REJECTED" }
            });
            return NextResponse.json({ success: true, action: "full_reject" });
        }

        // ── Mixed case — transaction ─────────────────────────────────────
        await prisma.$transaction(async (tx) => {
            // 1. Create a new PENDING_ADMIN request for approved materials
            if (approvedMaterials.length > 0) {
                const approvedTotal = approvedMaterials.reduce(
                    (sum, m) => sum + parseFloat(m.unit_price) * parseInt(m.quantity),
                    0
                );
                await tx.paymentRequest.create({
                    data: {
                        project_id: originalRequest.project_id,
                        supervisor_id: originalRequest.supervisor_id,
                        pm_id: user.id,
                        total_amount: approvedTotal,
                        status: "PENDING_ADMIN",
                        materials: {
                            create: approvedMaterials.map(m => ({
                                name: m.name,
                                quantity: m.quantity,
                                unit_price: m.unit_price,
                                description: m.description || null,
                                image_url: m.image_url || null,
                                image_file_id: m.image_file_id || null,
                                worker_id: m.worker_id || null
                            }))
                        }
                    }
                });
            }

            // 2. Create a new REJECTED request for rejected materials (so they're tracked)
            if (rejectedMaterials.length > 0 && pendingMaterials.length > 0) {
                // Only create separate rejected record when there are also pending items
                const rejectedTotal = rejectedMaterials.reduce(
                    (sum, m) => sum + parseFloat(m.unit_price) * parseInt(m.quantity),
                    0
                );
                await tx.paymentRequest.create({
                    data: {
                        project_id: originalRequest.project_id,
                        supervisor_id: originalRequest.supervisor_id,
                        pm_id: user.id,
                        total_amount: rejectedTotal,
                        status: "REJECTED",
                        materials: {
                            create: rejectedMaterials.map(m => ({
                                name: m.name,
                                quantity: m.quantity,
                                unit_price: m.unit_price,
                                description: m.description || null,
                                image_url: m.image_url || null,
                                image_file_id: m.image_file_id || null,
                                worker_id: m.worker_id || null
                            }))
                        }
                    }
                });
            }

            // 3. Update original request
            if (pendingMaterials.length > 0) {
                // Keep original as PENDING_PM with only the pending materials
                const pendingTotal = pendingMaterials.reduce(
                    (sum, m) => sum + parseFloat(m.unit_price) * parseInt(m.quantity),
                    0
                );
                // Remove approved and rejected materials from original
                const removedIds = [...approvedIds, ...rejectedIds];
                if (removedIds.length > 0) {
                    await tx.material.deleteMany({
                        where: { id: { in: removedIds }, request_id: requestId }
                    });
                }
                await tx.paymentRequest.update({
                    where: { id: requestId },
                    data: { total_amount: pendingTotal, status: "PENDING_PM" }
                });
            } else {
                // No pending items — mark original as REJECTED (approved ones are in new request)
                if (rejectedMaterials.length > 0) {
                    await tx.material.deleteMany({
                        where: { id: { in: approvedIds }, request_id: requestId }
                    });
                    await tx.paymentRequest.update({
                        where: { id: requestId },
                        data: {
                            status: "REJECTED",
                            total_amount: rejectedMaterials.reduce(
                                (sum, m) => sum + parseFloat(m.unit_price) * parseInt(m.quantity), 0
                            )
                        }
                    });
                } else {
                    // All approved — clean up original
                    await tx.material.deleteMany({ where: { request_id: requestId } });
                    await tx.paymentRequest.delete({ where: { id: requestId } });
                }
            }
        });

        const action = pendingMaterials.length > 0 ? "partial_with_pending" : "partial_approve";
        return NextResponse.json({ success: true, action });
    } catch (error) {
        console.error("Approve-partial error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
