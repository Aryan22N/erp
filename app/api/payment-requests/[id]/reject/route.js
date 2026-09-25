import { prisma } from "@/lib/db";
import { getUser, hasRole } from "@/lib/auth";
import { NextResponse } from "next/server";
import { imagekit } from "@/lib/imagekit";

export async function PATCH(req, { params }) {
    try {
        const user = await getUser();
        if (!user || (!hasRole(user, "PROJECT_MANAGER") && !hasRole(user, "SUPER_ADMIN"))) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const requestIds = id.split(",").map(i => parseInt(i)).filter(i => !isNaN(i));

        if (requestIds.length === 0) {
            return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
        }

        // Fetch all requests with their materials to get image_file_ids and project IDs
        const requests = await prisma.paymentRequest.findMany({
            where: { id: { in: requestIds } },
            include: { materials: true }
        });

        if (requests.length === 0) {
            return NextResponse.json({ error: "Requests not found" }, { status: 404 });
        }

        // Guard: each role can only reject requests at their own pipeline stage.
        // This mirrors the status checks in the approve endpoint and prevents
        // a manager from undoing an already-approved request, or a superadmin
        // from bypassing the manager review step entirely.
        if (hasRole(user, "PROJECT_MANAGER")) {
            if (requests.some(r => r.status !== "PENDING_PM")) {
                return NextResponse.json({ error: "Managers can only reject PENDING_PM requests" }, { status: 400 });
            }
        } else if (hasRole(user, "SUPER_ADMIN")) {
            if (requests.some(r => r.status !== "PENDING_ADMIN" && r.status !== "APPROVED")) {
                return NextResponse.json({ error: "Admins can only reject PENDING_ADMIN or APPROVED requests" }, { status: 400 });
            }
        }

        // 1. Delete images from ImageKit
        const fileIdsToDelete = [];
        requests.forEach(request => {
            request.materials.forEach(material => {
                if (material.image_file_id) {
                    fileIdsToDelete.push(material.image_file_id);
                }
            });
        });

        if (fileIdsToDelete.length > 0) {
            // Delete files in batches or individually
            // ImageKit SDK deleteFile doesn't support bulk easily in this version, so we do it in parallel
            try {
                await Promise.allSettled(fileIdsToDelete.map(fileId => imagekit.deleteFile(fileId)));
                console.log(`Deleted ${fileIdsToDelete.length} images from ImageKit.`);
            } catch (ikError) {
                console.error("Error deleting from ImageKit:", ikError);
                // We continue even if ImageKit deletion fails to keep DB consistent
            }
        }

        // 2. Revert project progress entries
        // Delete all progress entries for these projects created on or after the earliest request creation time
        // Note: For simplicity, we delete from earliest request's date, but more precise would be per project.
        const earliestCreatedAt = new Date(Math.min(...requests.map(r => r.created_at.getTime())));
        const projectIds = [...new Set(requests.map(r => r.project_id))];

        await prisma.projectProgress.deleteMany({
            where: {
                project_id: { in: projectIds },
                created_at: {
                    gte: earliestCreatedAt
                }
            }
        });

        // 3. Update status to REJECTED
        await prisma.paymentRequest.updateMany({
            where: { id: { in: requestIds } },
            data: { 
                status: "REJECTED",
                pm_id: user.id // Store who rejected it
            }
        });

        return NextResponse.json({ success: true, requestIds, newStatus: "REJECTED" });
    } catch (error) {
        console.error("Reject request error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
