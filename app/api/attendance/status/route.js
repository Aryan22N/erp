import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getISTAttendanceDayStart } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const user = await getUser();
        if (!user || (user.role !== "SUPERVISOR" && user.role !== "PROJECT_MANAGER")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Day boundary at 3:00 AM IST, same convention the app already used.
        // Uses the IST-aware helper so the boundary is always at the correct
        // absolute UTC timestamp regardless of the server's local timezone.
        const now = new Date();
        const startOfDay = getISTAttendanceDayStart();

        // Every check-in/check-out pair for today, oldest first. This is the
        // raw log — nothing here is a computed/stored aggregate.
        const todaySessions = await prisma.attendance.findMany({
            where: {
                userId: user.id,
                checkInTime: { gte: startOfDay }
            },
            include: { checkInSite: { select: { id: true, name: true } } },
            orderBy: { checkInTime: "asc" }
        });

        // Recalculate everything from the raw checkInTime/checkOutTime values
        // ourselves, in JS, rather than trusting any stored/derived DB field.
        let totalMinutesToday = 0;
        const sessions = todaySessions.map((s) => {
            const checkInTime = s.checkInTime;
            const checkOutTime = s.checkOutTime;
            const endForCalc = checkOutTime ? new Date(checkOutTime) : now;
            const minutes = Math.max(0, Math.floor((endForCalc - new Date(checkInTime)) / (1000 * 60)));
            totalMinutesToday += minutes;

            return {
                id: s.id,
                site: s.checkInSite ? { id: s.checkInSite.id, name: s.checkInSite.name } : null,
                checkInTime,
                checkOutTime,
                status: s.status,
                minutes
            };
        });

        const activeSession = todaySessions.find((s) => s.status === "CHECKED_IN")
            // Active session might have started before today's boundary (e.g. an overnight shift)
            || await prisma.attendance.findFirst({
                where: { userId: user.id, status: "CHECKED_IN" },
                include: { checkInSite: { select: { id: true, name: true } } },
                orderBy: { checkInTime: "desc" }
            });

        if (!activeSession) {
            // No open session right now. Check-in is ALWAYS available here —
            // there is no once-a-day / time-bound restriction. A user can
            // check in again immediately after checking out.
            return NextResponse.json({
                checkedIn: false,
                canCheckIn: true,
                canCheckout: false,
                activeSite: null,
                sessions,
                totalMinutesToday,
                sessionCountToday: sessions.length
            });
        }

        return NextResponse.json({
            checkedIn: true,
            canCheckIn: false,
            canCheckout: true,
            activeSite: activeSession.checkInSite ? { id: activeSession.checkInSite.id, name: activeSession.checkInSite.name } : null,
            sessions,
            totalMinutesToday,
            sessionCountToday: sessions.length
        });

    } catch (error) {
        console.error("Attendance status error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
