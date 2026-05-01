-- Migration: 20260501_support_tickets_add_fields
-- Add missing fields to support_tickets table
-- Run in Supabase dashboard SQL editor or via supabase db push

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS title        text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS priority     text,
  ADD COLUMN IF NOT EXISTS category     text;

-- Ensure status defaults to 'new' for new rows
ALTER TABLE support_tickets
  ALTER COLUMN status SET DEFAULT 'new';

-- Ensure service role can UPDATE (may already be covered by existing policy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'support_tickets'
    AND policyname = 'service_update_tickets'
  ) THEN
    CREATE POLICY "service_update_tickets" ON support_tickets
      FOR UPDATE USING (true);
  END IF;
END $$;
