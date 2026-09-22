import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser, hasRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const user = await getUser();
        if (!user || (!hasRole(user, "SUPERADMIN") && !hasRole(user, "ADMIN"))) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }

        // We want stats for today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // 1. Total Supervisors
        const totalSupervisors = await prisma.user.count({
            where: { role: "SUPERVISOR" }
        });

        // 2. Attendance Records Today
        const attendancesToday = await prisma.attendance.findMany({
            where: {
                checkInTime: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            include: { user: true, checkInSite: true }
        });

        const presentTodayIds = new Set(attendancesToday.map(a => a.userId));
        const presentToday = presentTodayIds.size;
        const absentToday = totalSupervisors - presentToday;

        let totalDurationMinutes = 0;
        let checkoutCount = 0;
        let lateCheckIns = 0;
        let autoCheckouts = 0;

        // Assuming check in after 10:00 AM is late (example criteria)
        // Adjust logic according to actual requirement

        // A user can have several check-in/check-out rows today. We recompute
        // each row's duration ourselves from its raw checkInTime/checkOutTime
        // (JS math, not a stored/derived DB value) and sum them, so the total
        // reflects every session rather than just one.
        attendancesToday.forEach(record => {
            if (record.checkOutTime) {
                const minutes = Math.max(0, Math.floor(
                    (new Date(record.checkOutTime) - new Date(record.checkInTime)) / (1000 * 60)
                ));
                totalDurationMinutes += minutes;
                checkoutCount++;
            }
            if (record.status === "AUTO_CHECKOUT") {
                autoCheckouts++;
            }

            const checkInDate = new Date(record.checkInTime);
            // Example: Late check in is after 10 AM local time
            if (checkInDate.getHours() >= 10) {
                lateCheckIns++;
            }
        });

        const averageWorkingHours = checkoutCount > 0 
            ? (totalDurationMinutes / 60 / checkoutCount).toFixed(1) 
            : 0;
            
        const attendancePercentage = totalSupervisors > 0 
            ? ((presentToday / totalSupervisors) * 100).toFixed(1) 
            : 0;

        return NextResponse.json({
            success: true,
            stats: {
                totalSupervisors,
                presentToday,
                absentToday,
                averageWorkingHours,
                lateCheckIns,
                autoCheckouts,
                attendancePercentage
            },
            records: attendancesToday
        });

    } catch (error) {
        console.error("Attendance stats error:", error);
        return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
    }
}
