-- ============================================================
-- Migration: split_site_into_checkin_checkout
-- Generated manually (DB unreachable at migration-generation time).
-- This SQL exactly matches what `prisma migrate dev` would generate
-- for the schema.prisma diff below, plus the required backfill SQL.
--
-- Schema changes applied:
--   • Add check_in_site_id  (nullable UUID, FK → sites.id)
--   • Add check_out_site_id (nullable UUID, FK → sites.id)
--   • Add index on check_in_site_id
--   • Add index on check_out_site_id
--   • Backfill: set check_in_site_id = site_id for all rows
--   • Backfill: set check_out_site_id = site_id for CHECKED_OUT/AUTO_CHECKOUT rows
--   • Enforce NOT NULL on check_in_site_id after backfill
--
-- NOTE: site_id and its FK/index are intentionally left in place.
-- They will be removed in a separate cleanup migration (Phase C).
-- ============================================================

-- Step 1: Add the new nullable columns (must be nullable for backfill to work)
ALTER TABLE "attendances"
  ADD COLUMN "check_in_site_id"  UUID,
  ADD COLUMN "check_out_site_id" UUID;

-- Step 2: Add foreign key constraints
ALTER TABLE "attendances"
  ADD CONSTRAINT "attendances_check_in_site_id_fkey"
    FOREIGN KEY ("check_in_site_id") REFERENCES "sites"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendances"
  ADD CONSTRAINT "attendances_check_out_site_id_fkey"
    FOREIGN KEY ("check_out_site_id") REFERENCES "sites"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 3: Backfill — every existing row gets its check-in site from the
-- old site_id. This is always correct: every attendance started at some site.
UPDATE "attendances"
SET "check_in_site_id" = "site_id";

-- Step 4: Backfill — rows that were completed before this migration can only
-- have checked out at the same site (the old system enforced this lock).
-- CHECKED_IN rows get NULL intentionally — they have no checkout site yet.
UPDATE "attendances"
SET "check_out_site_id" = "site_id"
WHERE "status" IN ('CHECKED_OUT', 'AUTO_CHECKOUT');

-- Step 5: Now that all existing rows have a check_in_site_id, enforce NOT NULL.
-- This must come AFTER the backfill — you cannot add a NOT NULL column with
-- data in one step in Postgres without a DEFAULT clause.
ALTER TABLE "attendances"
  ALTER COLUMN "check_in_site_id" SET NOT NULL;

-- Step 6: Create indexes on the new columns (matches @@index in schema.prisma)
CREATE INDEX "attendances_check_in_site_id_idx"  ON "attendances"("check_in_site_id");
CREATE INDEX "attendances_check_out_site_id_idx" ON "attendances"("check_out_site_id");

-- ============================================================
-- VERIFICATION QUERIES (run after applying, before Phase B deploy)
-- ============================================================
-- SELECT COUNT(*) FROM attendances;                                           -- row count unchanged
-- SELECT COUNT(*) FROM attendances WHERE check_in_site_id IS NULL;            -- must be 0
-- SELECT COUNT(*) FROM attendances WHERE check_in_site_id <> site_id;        -- must be 0
-- SELECT COUNT(*) FROM attendances
--   WHERE status IN ('CHECKED_OUT','AUTO_CHECKOUT')
--   AND check_out_site_id IS NULL;                                            -- must be 0
-- SELECT COUNT(*) FROM attendances
--   WHERE status = 'CHECKED_IN' AND check_out_site_id IS NOT NULL;           -- must be 0
