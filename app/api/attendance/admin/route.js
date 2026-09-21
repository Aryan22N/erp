import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getISTMonthBounds, getISTDateKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req) {
    try {
        const user = await getUser();
        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const month = searchParams.get("month"); // 1-12
        const year = searchParams.get("year");   // e.g. 2026
        const siteId = searchParams.get("siteId");
        const role = searchParams.get("role");   // SUPERVISOR | PROJECT_MANAGER | all

        let whereClause = {};

        if (month && year) {
            // Use IST month bounds so records are grouped by the IST calendar
            // month, not the UTC month. getISTMonthBounds returns UTC Date objects
            // that correspond to IST midnight on the 1st and last day of the month.
            const { start: startDate, end: endDate } = getISTMonthBounds(parseInt(year), parseInt(month));
            
            whereClause.checkInTime = {
                gte: startDate,
                lt: endDate  // exclusive upper bound from getISTMonthBounds
            };
        }

        if (siteId && siteId !== "all") {
            whereClause.checkInSiteId = siteId;
        }

        // Filter by user role if specified
        if (role && role !== "all") {
            whereClause.user = { role: role };
        }

        const attendances = await prisma.attendance.findMany({
            where: whereClause,
            include: {
                user: {
                    select: { id: true, name: true, phone: true }
                },
                checkInSite: {
                    select: { id: true, name: true }
                },
                checkOutSite: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { checkInTime: "desc" }
        });

        // Group data by supervisor for summary. A user can have MULTIPLE
        // check-in/check-out log rows on the same calendar day (morning
        // session, evening session, etc.), so we group by date rather than
        // counting rows, and we recalculate every duration ourselves from
        // the raw checkInTime/checkOutTime on each row instead of trusting
        // any stored/derived DB value.
        const now = new Date();
        const summaryMap = {};

        attendances.forEach(record => {
            if (!record.user) return; // safeguard

            const userId = record.user.id;
            if (!summaryMap[userId]) {
                summaryMap[userId] = {
                    user: record.user,
                    presentDates: new Set(),
                    workedDates: new Set(),
                    sessionCount: 0,
                    totalMinutesWorked: 0,
                    history: []
                };
            }

            const entry = summaryMap[userId];
            const dateKey = getISTDateKey(record.checkInTime);

            entry.presentDates.add(dateKey);
            entry.sessionCount += 1;

            // Duration for this specific session, computed fresh from the
            // raw timestamps (still-open sessions count up to "now").
            const checkInTime = new Date(record.checkInTime);
            const checkOutForCalc = record.checkOutTime ? new Date(record.checkOutTime) : now;
            const minutes = Math.max(0, Math.floor((checkOutForCalc - checkInTime) / (1000 * 60)));
            entry.totalMinutesWorked += minutes;

            // If they successfully checked out (or auto-checkout implies completion)
            if (record.status === "CHECKED_OUT" || record.status === "AUTO_CHECKOUT") {
                entry.workedDates.add(dateKey);
            }

            entry.history.push({ ...record, durationMinutesComputed: minutes });
        });

        const summary = Object.values(summaryMap).map(entry => ({
            user: entry.user,
            daysPresent: entry.presentDates.size,
            daysWorked: entry.workedDates.size,
            sessionCount: entry.sessionCount,
            totalMinutesWorked: entry.totalMinutesWorked,
            history: entry.history
        }));

        return NextResponse.json({
            rawRecords: attendances,
            summary
        });

    } catch (error) {
        console.error("Superadmin attendance GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
