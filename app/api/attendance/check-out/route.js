import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { calculateDistance } from "@/lib/geolocation";

export const dynamic = "force-dynamic";

export async function POST(req) {
    try {
        const user = await getUser();
        if (!user || (user.role !== "SUPERVISOR" && user.role !== "PROJECT_MANAGER")) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { latitude, longitude, accuracy, checkoutSiteId } = body;

        if (!latitude || !longitude || accuracy == null || !checkoutSiteId) {
            return NextResponse.json({ success: false, message: "Missing location data or checkout site ID" }, { status: 400 });
        }

        // GPS Accuracy Validation
        if (accuracy > 300) {
            return NextResponse.json({
                success: false,
                message: `GPS accuracy too low (${Math.round(accuracy)}m). Please move to an open area.`
            }, { status: 400 });
        }

        // Find this user's currently open session (the specific check-in row
        // that hasn't been checked out yet). We only ever touch that one row.
        const activeSession = await prisma.attendance.findFirst({
            where: {
                userId: user.id,
                status: "CHECKED_IN"
            },
            orderBy: { checkInTime: "desc" }
        });

        if (!activeSession) {
            return NextResponse.json({ success: false, message: "No active check-in found to check out from." }, { status: 400 });
        }

        const checkoutSite = await prisma.site.findUnique({
            where: { id: checkoutSiteId }
        });

        if (!checkoutSite || checkoutSite.status !== "ACTIVE") {
            return NextResponse.json({ success: false, message: "Invalid or inactive checkout site." }, { status: 400 });
        }

        // Verify the user is still within the geofence of the checkout site.
        const distance = calculateDistance(checkoutSite.latitude, checkoutSite.longitude, latitude, longitude);

        if (distance > checkoutSite.radius) {
            return NextResponse.json({
                success: false,
                message: `You are too far from the checkout location. Distance: ${Math.round(distance)}m, Allowed: ${checkoutSite.radius}m`
            }, { status: 400 });
        }

        const now = new Date();
        const checkInTime = new Date(activeSession.checkInTime);

        // Duration is derived purely from the two raw timestamps we locked in
        // (checkInTime, now) via plain JS math — not from any DB-side
        // computation or trigger. We still cache it on the row for convenience,
        // but every report should feel free to recompute it the same way from
        // checkInTime/checkOutTime rather than trusting this cached value.
        const durationMinutes = Math.floor((now - checkInTime) / (1000 * 60));

        const checkOutLog = await prisma.attendance.update({
            where: { id: activeSession.id },
            data: {
                checkOutTime: now,
                checkOutLatitude: latitude,
                checkOutLongitude: longitude,
                checkOutAccuracy: accuracy,
                durationMinutes,
                status: "CHECKED_OUT"
            }
        });

        return NextResponse.json({ success: true, message: "Checked out successfully.", data: checkOutLog });

    } catch (error) {
        console.error("Check-out error:", error);
        return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
    }
}
