import { prisma } from "@/lib/db";
import { getUser, hasRole } from "@/lib/auth";
import { NextResponse } from "next/server";

// PATCH /api/payment-requests/:id/mark-paid
// Transitions APPROVED → PAID (Super Admin only)
// Accepts comma-separated IDs for bulk marking, consistent with the approve endpoint.
export async function PATCH(req, { params }) {
    try {
        const user = await getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!hasRole(user, "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Only Super Admin can mark requests as paid" }, { status: 403 });
        }

        const { id } = await params;
        const requestIds = id.split(",").map(i => parseInt(i)).filter(i => !isNaN(i));

        if (requestIds.length === 0) {
            return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
        }

        const requests = await prisma.paymentRequest.findMany({
            where: { id: { in: requestIds } }
        });

        if (requests.length === 0) {
            return NextResponse.json({ error: "Requests not found" }, { status: 404 });
        }

        // Guard: all targeted requests must be APPROVED.
        // PAID and PENDING_ADMIN are both invalid targets — this prevents
        // accidentally re-paying or skipping the approval step.
        const invalidRequests = requests.filter(r => r.status !== "APPROVED");
        if (invalidRequests.length > 0) {
            return NextResponse.json({
                error: "One or more requests are not in APPROVED status. Only APPROVED requests can be marked as Paid.",
                invalidIds: invalidRequests.map(r => r.id),
                invalidStatuses: [...new Set(invalidRequests.map(r => r.status))]
            }, { status: 400 });
        }

        await prisma.paymentRequest.updateMany({
            where: { id: { in: requestIds } },
            data: { status: "PAID" }
        });

        return NextResponse.json({ success: true, requestIds, newStatus: "PAID" });
    } catch (error) {
        console.error("Mark-paid request error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
