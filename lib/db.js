import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis;

function makePrisma() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
}

// In development, we use a global variable so that the value is preserved
// across hot reloads. This prevents connections from growing exponentially.
// If you update your schema, you might need to restart your dev server.
export const prisma = (() => {
    if (globalForPrisma.prisma) {
        // Force refresh if schema has been updated (check for latest model additions)
        if (process.env.NODE_ENV !== "production" && !globalForPrisma.__prisma_schema_v6) {
            delete globalForPrisma.prisma;
            globalForPrisma.__prisma_schema_v6 = true;
        } else {
            return globalForPrisma.prisma;
        }
    }
    if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma_schema_v6 = true;
    return makePrisma();
})();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
