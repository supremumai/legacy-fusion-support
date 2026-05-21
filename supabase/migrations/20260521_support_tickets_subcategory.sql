ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS resolved_by_ai boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

-- image_urls stores array of Supabase Storage public URLs
-- max 3 items enforced at application level
