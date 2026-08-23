import { prisma } from "@/lib/db";
import { getUser, hasRole } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
    try {
        const user = await getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const idsParam = searchParams.get('ids');
        if (!idsParam) {
            return NextResponse.json({ error: "Missing ids parameter" }, { status: 400 });
        }

        const requestIds = idsParam
            .split(',')
            .map(id => parseInt(id.trim()))
            .filter(id => !isNaN(id));

        if (requestIds.length === 0) {
            return NextResponse.json([]);
        }

        const whereClause = {
            id: { in: requestIds }
        };

        // Enforce strict project manager assignment filtering:
        // Managers can ONLY fetch details for projects assigned to them.
        if (hasRole(user, "PROJECT_MANAGER")) {
            whereClause.project = {
                managers: { some: { id: user.id } }
            };
        } else if (hasRole(user, "SUPERVISOR")) {
            whereClause.supervisor_id = user.id;
        }

        const requests = await prisma.paymentRequest.findMany({
            where: whereClause,
            include: {
                project: true,
                materials: {
                    include: {
                        worker: { select: { id: true, name: true, designation: true } }
                    }
                },
                supervisor: { select: { id: true, name: true, phone: true } },
                pm: { select: { id: true, name: true } }
            },
            orderBy: { created_at: "desc" }
        });

        return NextResponse.json(requests);
    } catch (error) {
        console.error("GET group-details error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
