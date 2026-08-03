ALTER TABLE public.meta_pages
  ADD COLUMN IF NOT EXISTS leads_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_lead_created_at timestamptz;