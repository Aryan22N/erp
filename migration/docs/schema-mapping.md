# Schema Mapping  Legacy Attendance Migration

## Source
- Old schema DB: `attendances` table (10 distinct users, 5 distinct sites, 180 rows)
- New schema DB: `attendances` table (192 existing rows, production)

## Field-by-field mapping

| Old Field           | New Field           | Type Match | Notes                                                                 |
|----------------------|----------------------|------------|------------------------------------------------------------------------|
| id                   | id                   | uuid = uuid | Reused as-is. Enables idempotent migration via `ON CONFLICT (id) DO NOTHING`. |
| userId               | userId               | int = int   | Verified: all old userIds (2â€“11) exist in new `users` table.          |
| siteId               | siteId               | uuid = uuid | Verified: all old siteIds exist in new `sites` table.                 |
| checkInTime          | checkInTime          | timestamp = timestamp | Direct copy, no transformation needed.                     |
| checkOutTime         | checkOutTime         | timestamp = timestamp (nullable) | Direct copy. Nullable in both (open/ongoing attendance). |
| checkInLatitude      | checkInLatitude      | float = float | Direct copy.                                                        |
| checkInLongitude     | checkInLongitude     | float = float | Direct copy.                                                        |
| checkOutLatitude     | checkOutLatitude     | float = float (nullable) | Direct copy.                                             |
| checkOutLongitude    | checkOutLongitude    | float = float (nullable) | Direct copy.                                             |
| checkInAccuracy      | checkInAccuracy      | float = float | Direct copy.                                                        |
| checkOutAccuracy     | checkOutAccuracy     | float = float (nullable) | Direct copy.                                             |
| durationMinutes      | durationMinutes      | int = int (nullable) | Direct copy.                                                 |
| status               | status               | enum = enum | Identical enum values (`CHECKED_IN`, `CHECKED_OUT`, `AUTO_CHECKOUT`, `REJECTED`). Direct copy. |
| createdAt            | createdAt            | timestamp = timestamp | Direct copy â€” preserves original record creation time.     |
| updatedAt            | updatedAt            | timestamp = timestamp | Direct copy.                                                |
| *(not present)*      | checkInSiteId        | uuid, nullable | **New field, absent in old schema.** Set to `NULL` for all migrated records |
| *(not present)*      | checkOutSiteId       | uuid, nullable | **New field, absent in old schema.** Set to `NULL` for all migrated records |

## Employee/user reference differences
None `userId` is an integer foreign key in both schemas, and all values are confirmed to exist in the new `users` table.

## Date/time format differences
None both schemas use native Postgres `timestamp(3) without time zone`. No string parsing or timezone conversion required.

## Check-in/check-out information differences
None structurally. All check-in/check-out fields (time, lat/long, accuracy) map 1:1.

## Location/multi-location differences
The new schema introduces `checkInSiteId` and `checkOutSiteId` to support scenarios where check-in and check-out might happen at different sites. The old schema only tracked a single `siteId` per record.

## Attendance status differences
None enum values are identical between schemas.

## Session-related fields
None identified beyond what's covered above (no separate "session" table/fields found in either schema).

## Idempotency strategy
Old `id` (uuid) is reused directly as the new row's primary key. The migration script checks for an existing record with the same `id` in the new database before inserting (`findUnique`); if found, the record is skipped. This guarantees re-running the script never creates duplicates.

## Pre-migration validation performed
- [x] Row count recorded (old: 180, new before: 192)
- [x] All old `userId` values confirmed to exist in new `users` table
- [x] All old `siteId` values confirmed to exist in new `sites` table
- [x] `AttendanceStatus` enum values confirmed identical in both schemas
