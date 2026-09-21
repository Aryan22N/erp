-- ============================================================
-- Migration: drop_legacy_site_id (Phase C)
--
-- Run this ONLY after Phase B app code has been live and verified
-- for at least one full attendance cycle (ideally a full working day).
--
-- What this removes:
--   • The site_id column (was the old single-site FK)
--   • The FK constraint on site_id
--   • The index on site_id
--
-- The check_in_site_id and check_out_site_id columns introduced in
-- Phase A remain untouched — this migration only removes the legacy field.
-- ============================================================

-- Drop the index first (index must be dropped before column)
DROP INDEX IF EXISTS "attendances_site_id_idx";

-- Drop the FK constraint
ALTER TABLE "attendances"
  DROP CONSTRAINT IF EXISTS "attendances_site_id_fkey";

-- Drop the legacy column
ALTER TABLE "attendances"
  DROP COLUMN "site_id";

-- ============================================================
-- VERIFICATION QUERIES (run after applying)
-- ============================================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'attendances' AND column_name = 'site_id';  -- must return 0 rows
-- SELECT COUNT(*) FROM attendances;                                 -- row count unchanged
-- SELECT COUNT(*) FROM attendances WHERE check_in_site_id IS NULL; -- must be 0
