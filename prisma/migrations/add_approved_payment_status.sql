-- Migration: add APPROVED to PaymentStatus enum
-- Run this on your Neon / PostgreSQL database directly or via Prisma push.
--
-- The APPROVED status sits between PENDING_ADMIN and PAID:
--   PENDING_ADMIN → (SA Approve) → APPROVED → (SA Mark Paid) → PAID
--
-- This is safe to run on existing data because no existing rows use APPROVED.
-- Existing PAID rows are unaffected.

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'APPROVED' BEFORE 'PAID';

-- Migration: add pm_bypassed audit column
-- When true: Super Admin directly approved a PENDING_PM request (Manager was bypassed).
-- When false (default): request followed the normal Manager → Admin flow.
-- Safe to apply on existing data — DEFAULT FALSE backfills all rows to false.
ALTER TABLE payment_requests
    ADD COLUMN IF NOT EXISTS pm_bypassed BOOLEAN NOT NULL DEFAULT FALSE;
