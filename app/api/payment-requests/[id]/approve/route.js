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

        let nextStatus;

        if (hasRole(user, "PROJECT_MANAGER")) {
            if (requests.some(r => r.status !== "PENDING_PM")) {
                return NextResponse.json({ error: "One or more requests have invalid status for Manager approval" }, { status: 400 });
            }
            
            // Budget Validation Logic
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
                
                const currentApprovedSum = currentApprovedRequests._sum.total_amount ? parseFloat(currentApprovedRequests._sum.total_amount) : 0;
                const approvingSum = requests.reduce((sum, req) => sum + parseFloat(req.total_amount), 0);
                
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

            nextStatus = "PENDING_ADMIN";
        } else if (hasRole(user, "SUPER_ADMIN")) {
            if (requests.some(r => r.status !== "PENDING_ADMIN")) {
                return NextResponse.json({ error: "One or more requests have invalid status for Admin approval" }, { status: 400 });
            }
            nextStatus = "APPROVED";

            // Process selective image deletion if provided by Super Admin
            if (Array.isArray(deleteFileIds) && deleteFileIds.length > 0) {
                try {
                    // 1. Delete from ImageKit
                    await Promise.allSettled(deleteFileIds.map(fileId => imagekit.deleteFile(fileId)));
                    
                    // 2. Clear relevant material records in DB
                    await prisma.material.updateMany({
                        where: {
                            request_id: { in: requestIds },
                            image_file_id: { in: deleteFileIds }
                        },
                        data: {
                            image_url: null,
                            image_file_id: null
                        }
                    });
                    console.log(`Selective deletion: ${deleteFileIds.length} images deleted and cleared.`);
                } catch (ikError) {
                    console.error("Selective deletion error:", ikError);
                    // Continue with approval even if deletion fails
                }
            }
        } else {
            return NextResponse.json({ error: "Unauthorized role" }, { status: 401 });
        }

        const updateData = { status: nextStatus };
        if (hasRole(user, "PROJECT_MANAGER")) {
            updateData.pm_id = user.id;
        }

        await prisma.paymentRequest.updateMany({
            where: { id: { in: requestIds } },
            data: updateData
        });

        return NextResponse.json({ success: true, requestIds, newStatus: nextStatus });
    } catch (error) {
        console.error("Approve request error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
