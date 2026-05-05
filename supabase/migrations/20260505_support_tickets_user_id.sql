-- Migration: add user_id column to support_tickets
-- Batch A: Remove GHL opportunity creation + My Tickets backend
-- 2026-05-05

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS user_id text;

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id
  ON support_tickets(user_id);
