CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('tiktok','meta')),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  external_lead_id text,
  external_form_id text,
  external_ad_id text,
  external_campaign_id text,
  full_name text,
  email text,
  phone text,
  message text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_url text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','appointment_scheduled','won','lost')),
  notes text,
  assignee text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own leads"
  ON public.leads
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS leads_user_created_idx ON public.leads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leads_platform_idx ON public.leads(user_id, platform);
CREATE INDEX IF NOT EXISTS leads_status_idx ON public.leads(user_id, status);
CREATE INDEX IF NOT EXISTS leads_campaign_idx ON public.leads(campaign_id);

-- Dedup: same user + platform + campaign + email/phone is unique
CREATE UNIQUE INDEX IF NOT EXISTS leads_dedup_email_idx
  ON public.leads(user_id, platform, COALESCE(campaign_id::text,''), lower(email))
  WHERE email IS NOT NULL AND email <> '';
CREATE UNIQUE INDEX IF NOT EXISTS leads_dedup_phone_idx
  ON public.leads(user_id, platform, COALESCE(campaign_id::text,''), phone)
  WHERE phone IS NOT NULL AND phone <> '';
CREATE UNIQUE INDEX IF NOT EXISTS leads_dedup_external_idx
  ON public.leads(platform, external_lead_id)
  WHERE external_lead_id IS NOT NULL;

CREATE TRIGGER trg_leads_updated
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();