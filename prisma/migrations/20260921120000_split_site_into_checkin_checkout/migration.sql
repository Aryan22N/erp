-- ============================================================
-- Migration: split_site_into_checkin_checkout
-- ============================================================

-- Step 1: Add the new nullable columns (must be nullable for backfill to work)
ALTER TABLE "attendances"
  ADD COLUMN IF NOT EXISTS "checkInSiteId"  UUID,
  ADD COLUMN IF NOT EXISTS "checkOutSiteId" UUID;

-- Step 2: Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendances_checkInSiteId_fkey') THEN
    ALTER TABLE "attendances"
      ADD CONSTRAINT "attendances_checkInSiteId_fkey"
        FOREIGN KEY ("checkInSiteId") REFERENCES "sites"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendances_checkOutSiteId_fkey') THEN
    ALTER TABLE "attendances"
      ADD CONSTRAINT "attendances_checkOutSiteId_fkey"
        FOREIGN KEY ("checkOutSiteId") REFERENCES "sites"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Step 3: Backfill — every existing row gets its check-in site from the old siteId.
UPDATE "attendances"
SET "checkInSiteId" = "siteId"
WHERE "checkInSiteId" IS NULL;

-- Step 4: Backfill — rows completed before this migration get checkOutSiteId from old siteId.
UPDATE "attendances"
SET "checkOutSiteId" = "siteId"
WHERE "status" IN ('CHECKED_OUT', 'AUTO_CHECKOUT') AND "checkOutSiteId" IS NULL;

-- Step 5: Create indexes on the new columns
CREATE INDEX IF NOT EXISTS "attendances_checkInSiteId_idx"  ON "attendances"("checkInSiteId");
CREATE INDEX IF NOT EXISTS "attendances_checkOutSiteId_idx" ON "attendances"("checkOutSiteId");
