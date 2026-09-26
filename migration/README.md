# Legacy Attendance Migration

This folder contains the tooling used to migrate legacy attendance records
from the old database schema into the current (new) schema.

## Contents
- `old-schema/` — Prisma schema + generated client for the OLD database (introspected via `prisma db pull`)
- `scripts/migrate-attendance.ts` — the migration script itself
- `docs/schema-mapping.md` — field-by-field mapping between old and new schemas
- `docs/execution-notes.md` — full log of backups taken, staging tests, validation results, and the final production run

## How to run this script

1. Ensure `.env` has `DATABASE_URL` (new schema) and `OLD_DATABASE_URL` (old schema) set correctly.
   - For a dry run, point both at local staging copies restored from backups.
   - For a real run, point both at the real production connection strings (take a fresh backup first).
2. Install dependencies if needed: `npm install`
3. Generate the old schema's Prisma client (only needed once, or after schema changes): npx prisma generate --schema=./migration/old-schema/schema.prisma --config=./migration/old-schema/prisma.config.ts
4. Run the migration: npx tsx migration/scripts/migrate-attendance.ts
5. Review the printed summary (migrated / skipped / failed counts).

## Idempotency
The script reuses each old record's original `id` (UUID) as the new row's
primary key, and checks for existing records by `id` before inserting. Running
the script multiple times is always safe — it will never create duplicate
attendance records.

## Known outcome (as of 2026-09-26)
All 180 legacy attendance records were found to already exist in the
production database prior to this task (see `docs/execution-notes.md` for
full validation proof). Running this script against production is therefore
expected to report 180 skipped, 0 migrated, 0 failed — this is correct,
expected behavior, not an error.