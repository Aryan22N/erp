import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis;

function makePrisma() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        max: 15,               // pool size to support concurrent Next.js requests
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
        keepAlive: true,
    });

    // Log unexpected pool errors so they don't silently crash the process
    pool.on("error", (err) => {
        console.error("pg pool error:", err.message);
    });

    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
}

// True singleton — create once, reuse forever across hot reloads in dev.
// Never forcefully recreate: if the schema changes, restart the dev server.
if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = makePrisma();
}

export const prisma = globalForPrisma.prisma;
