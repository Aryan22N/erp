import 'dotenv/config';
import { PrismaClient as OldPrismaClient } from '../old-schema/generated-old-client';
import { PrismaClient as NewPrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// --- OLD DB connection setup ---
const oldPool = new pg.Pool({
  connectionString: process.env.OLD_DATABASE_URL,
});
const oldAdapter = new PrismaPg(oldPool);
const oldDb = new OldPrismaClient({ adapter: oldAdapter });

// --- NEW DB connection setup ---
const newPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const newAdapter = new PrismaPg(newPool);
const newDb = new NewPrismaClient({ adapter: newAdapter });

async function main() {
  console.log('Starting legacy attendance migration...');

  const oldRecords = await oldDb.attendances.findMany();
  console.log(`Found ${oldRecords.length} records in old database.`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const record of oldRecords) {
    try {
      const existing = await newDb.attendance.findUnique({
        where: { id: record.id },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await newDb.attendance.create({
        data: {
          id: record.id,
          userId: record.userId,
          siteId: record.siteId,
          checkInTime: record.checkInTime,
          checkOutTime: record.checkOutTime,
          checkInLatitude: record.checkInLatitude,
          checkInLongitude: record.checkInLongitude,
          checkOutLatitude: record.checkOutLatitude,
          checkOutLongitude: record.checkOutLongitude,
          checkInAccuracy: record.checkInAccuracy,
          checkOutAccuracy: record.checkOutAccuracy,
          durationMinutes: record.durationMinutes,
          status: record.status,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          checkInSiteId: null,
          checkOutSiteId: null,
        },
      });

      migrated++;
    } catch (err) {
      failed++;
      console.error(`Failed to migrate record ${record.id}:`, err);
    }
  }

  console.log('--- Migration Summary ---');
  console.log(`Total old records found: ${oldRecords.length}`);
  console.log(`Successfully migrated:   ${migrated}`);
  console.log(`Skipped (already exist): ${skipped}`);
  console.log(`Failed:                  ${failed}`);
}

main()
  .catch((e) => {
    console.error('Migration script crashed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await oldDb.$disconnect();
    await newDb.$disconnect();
    await oldPool.end();
    await newPool.end();
  });
