-- Migration: 20260501_support_tickets_sla_summary
-- Add sla_deadline and summary fields to support_tickets
-- Run in Supabase dashboard SQL editor or via supabase db push

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS sla_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS summary      text;
