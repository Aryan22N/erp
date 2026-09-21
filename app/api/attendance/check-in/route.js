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
        const { latitude, longitude, accuracy, siteId } = body;

        if (!latitude || !longitude || accuracy == null || !siteId) {
            return NextResponse.json({ success: false, message: "Missing location or site data" }, { status: 400 });
        }

        // GPS Accuracy Validation
        if (accuracy > 300) {
            return NextResponse.json({
                success: false,
                message: `GPS accuracy too low (${Math.round(accuracy)}m). Please move to an open area.`
            }, { status: 400 });
        }

        // A user can only have ONE open (not-yet-checked-out) session at a time.
        // This does NOT limit them to one session per day — as soon as they check
        // out, this query returns nothing and they're free to check in again
        // (morning session, midday break, evening session, etc.), each one
        // becoming its own log row.
        const existingSession = await prisma.attendance.findFirst({
            where: {
                userId: user.id,
                status: "CHECKED_IN"
            }
        });

        if (existingSession) {
            return NextResponse.json({ success: false, message: "Already checked in. Please check out first." }, { status: 400 });
        }

        // Fetch the selected site
        const site = await prisma.site.findUnique({
            where: { id: siteId }
        });

        if (!site || site.status !== "ACTIVE") {
            return NextResponse.json({ success: false, message: "Selected site is invalid or inactive." }, { status: 400 });
        }

        const distance = calculateDistance(site.latitude, site.longitude, latitude, longitude);

        if (distance > site.radius) {
            return NextResponse.json({
                success: false,
                message: `You are too far from the selected project location. Distance: ${Math.round(distance)}m, Allowed: ${site.radius}m`
            }, { status: 400 });
        }

        // Create a brand-new log entry for THIS check-in. We never reuse or merge
        // rows across sessions — every check-in/check-out pair is its own record,
        // so a user can have any number of these per day at the same project.
        const checkInLog = await prisma.attendance.create({
            data: {
                userId: user.id,
                checkInSiteId: site.id,   // new split-site column (Phase B)
                siteId: site.id,          // legacy column — kept until Phase C cleanup
                checkInTime: new Date(),
                checkInLatitude: latitude,
                checkInLongitude: longitude,
                checkInAccuracy: accuracy,
                status: "CHECKED_IN"
            }
        });

        return NextResponse.json({ success: true, message: "Checked in successfully.", data: checkInLog });

    } catch (error) {
        console.error("Check-in error:", error);
        return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
    }
}
