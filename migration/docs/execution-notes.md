# Migration Execution Notes

## Backup Log
- [2026-09-24 19:44] erp-new-prod-backup-2026-09-24.dump taken from PROD_NEW_DATABASE_URL (production, before any migration work)  61,014 bytes
- [2026-09-24 19:55] erp-old-source-backup-2026-09-24.dump taken from OLD_SOURCE_DATABASE_URL (old source, before any migration work)  55,813 bytes

Backup files stored locally at: migration/backups/ (gitignored, not committed to repo)

## Before Migration Production Row Counts
- attendances table: 192 rows (as of 2026-09-24, production/new schema, via psql COUNT(*))

## Schema Overview (Production - New Schema)
Tables observed: ProjectManagers, archived_progress, attendances, bills, materials,
payment_requests, project_progress, projects, reminders, sites, users, workers

## Validation  ID-Level Cross-Check (Staging)
- Old database total records: 180
- New database total records (before script run): 192
- Old records confirmed present in new database: 180 (100% match)
- New database records not originating from old data: 12
- Math check: 180 + 12 = 192  (matches new DB total exactly)

## Conclusion
All legacy attendance records had already been migrated into the new schema
prior to this task. The migration script was run against a staging copy and
correctly identified all 180 records as already existing, skipping every one
(idempotency confirmed) with zero duplicates created and zero failures.

## Idempotency Proof Staging (Two Consecutive Runs)

### Run 1
- Total old records found: 180
- Successfully migrated: 0
- Skipped (already exist): 180
- Failed: 0
- New DB row count after run: 192

### Run 2 (re-run, same script, same staging DB, no changes made)
- Total old records found: 180
- Successfully migrated: 0
- Skipped (already exist): 180
- Failed: 0
- New DB row count after run: 192

### Conclusion
Running the migration script multiple times produces identical results with
zero duplicate records created. Row count remained at 192 across both runs,
confirming the script is safely idempotent.

## Regression Check  Post-Migration Table Integrity
- Performed a test insert directly against `erp_new_staging.attendances` after migration script runs.
- Insert succeeded (foreign keys, enum, required fields all validated correctly).
- Row count went 192, 193 after insert, then back to 192 after cleanup delete.
- Confirms existing attendance table functionality remains intact post-migration.

## Before Migration Production Row Counts (Second Check, Just Before Real Run)
- attendances table: 201 rows (as of 2026-09-26, immediately before production script run)
- Note: this is 9 more than the earlier baseline of 192 recorded on 2026-09-24,
  reflecting normal live usage/growth on production between the two checks.

## Production Migration Run  Final Execution
- Date: 2026-09-26
- Pre-run backup taken: erp-new-prod-backup-2026-09-26-pre-migration.dump
- Pre-run row count: 201
- Script executed directly against real production + real old-source database
- Total old records found: 180
- Successfully migrated: 0
- Skipped (already exist): 180
- Failed: 0

- Conclusion: All 180 legacy records were already present in production prior
  to this task. The migration script correctly identified this via its
  idempotency check and made zero changes, creating zero duplicates.
  .env reverted to staging configuration immediately after this run.

- Post-run row count: 201 (unchanged from pre-run count of 201)
- Math check: 201 (before) + 0 (migrated) = 201 (after) 
