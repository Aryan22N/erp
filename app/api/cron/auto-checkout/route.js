import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getISTAttendanceDayStart } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req) {
    try {
        // Vercel Cron passes the CRON_SECRET automatically via the Authorization
        // header when the variable is set in the Vercel environment.
        const authHeader = req.headers.get("authorization");
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }

        // Cutoff = 03:00 IST of the current attendance day — the same boundary
        // used by the status route and attendance-day grouping throughout the app.
        // Using this canonical timestamp (not Date.now()) means:
        //   1. All records within a cron run get the same checkOutTime regardless
        //      of how long the update loop takes.
        //   2. The auto-checkout boundary aligns with "today" as the UI defines it.
        //   3. Night-shift workers who check in after 03:00 IST are never touched
        //      by the same-day run — their session's checkInTime is after the cutoff.
        const cutoff = getISTAttendanceDayStart(); // 03:00 IST today (UTC equivalent stored)

        // Find every session that started before the cutoff and was never closed.
        // Rows with status AUTO_CHECKOUT or CHECKED_OUT are already closed — the
        // status filter makes this query idempotent (safe to run multiple times).
        const expiredSessions = await prisma.attendance.findMany({
            where: {
                status: "CHECKED_IN",
                checkInTime: { lt: cutoff }
            }
        });

        let updatedCount = 0;

        for (const session of expiredSessions) {
            const checkInTime = new Date(session.checkInTime);
            // Duration ends at the cutoff, not at the cron fire time, so the
            // number is deterministic and matches what the UI would compute from
            // checkInTime / checkOutTime.
            const durationMinutes = Math.floor((cutoff - checkInTime) / (1000 * 60));

            await prisma.attendance.update({
                where: { id: session.id },
                data: {
                    status:            "AUTO_CHECKOUT",
                    checkOutTime:      cutoff,
                    durationMinutes,
                    // No verified checkout location exists for auto-closed sessions.
                    // Explicit nulls so the intent is clear and the fields are not
                    // left with any stale value from a previous partial update.
                    checkOutSiteId:    null,
                    checkOutLatitude:  null,
                    checkOutLongitude: null,
                    checkOutAccuracy:  null,
                }
            });
            updatedCount++;
        }

        return NextResponse.json({
            success:      true,
            message:      `Auto-checkout applied to ${updatedCount} session(s).`,
            updatedCount,
            cutoff:       cutoff.toISOString(),
        });

    } catch (error) {
        console.error("Auto-checkout cron error:", error);
        return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
    }
}
