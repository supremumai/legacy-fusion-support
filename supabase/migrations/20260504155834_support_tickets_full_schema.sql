-- Add columns to support_tickets for manual ticket creation and source tracking
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS assigned_to text,
  ADD COLUMN IF NOT EXISTS plan text,
  ADD COLUMN IF NOT EXISTS ghl_contact_id text;

-- ghl_opportunity_id is now optional (manual tickets won't have it)
ALTER TABLE support_tickets
  ALTER COLUMN ghl_opportunity_id DROP NOT NULL;
