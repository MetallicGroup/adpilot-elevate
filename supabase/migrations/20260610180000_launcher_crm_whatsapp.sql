-- 5-minute launcher, unified CRM, WhatsApp assistant

CREATE TABLE public.draft_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  niche TEXT,
  promotion_goal TEXT,
  service TEXT,
  city TEXT,
  radius_km INTEGER NOT NULL DEFAULT 15,
  daily_budget NUMERIC(12,2) NOT NULL DEFAULT 50,
  simple_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_copy JSONB,
  lead_form_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  technical_config JSONB,
  creative_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  whatsapp_followup TEXT,
  daily_report_template TEXT,
  meta_campaign_uuid UUID REFERENCES public.meta_campaigns(id) ON DELETE SET NULL,
  tiktok_campaign_uuid UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  created_from TEXT NOT NULL DEFAULT 'dashboard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.draft_campaigns TO authenticated;
GRANT ALL ON public.draft_campaigns TO service_role;
ALTER TABLE public.draft_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own draft campaigns" ON public.draft_campaigns
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.leads_crm (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  campaign_id UUID,
  campaign_name TEXT,
  ad_account_id TEXT,
  platform_lead_id TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  email TEXT,
  custom_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, platform_lead_id)
);
CREATE INDEX idx_leads_crm_user_status ON public.leads_crm(user_id, status);
CREATE INDEX idx_leads_crm_user_created ON public.leads_crm(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads_crm TO authenticated;
GRANT ALL ON public.leads_crm TO service_role;
ALTER TABLE public.leads_crm ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own CRM leads" ON public.leads_crm
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.lead_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads_crm(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lead_timeline_lead ON public.lead_timeline(lead_id, created_at DESC);
GRANT SELECT, INSERT ON public.lead_timeline TO authenticated;
GRANT ALL ON public.lead_timeline TO service_role;
ALTER TABLE public.lead_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own lead timeline" ON public.lead_timeline
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_whatsapp_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (phone),
  UNIQUE (user_id, phone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_whatsapp_phones TO authenticated;
GRANT ALL ON public.user_whatsapp_phones TO service_role;
ALTER TABLE public.user_whatsapp_phones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own whatsapp phones" ON public.user_whatsapp_phones
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL UNIQUE,
  current_step TEXT NOT NULL DEFAULT 'idle',
  intent TEXT,
  draft_campaign_id UUID REFERENCES public.draft_campaigns(id) ON DELETE SET NULL,
  collected_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversation_sessions_user ON public.conversation_sessions(user_id);
GRANT ALL ON public.conversation_sessions TO service_role;
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;
-- Sessions managed server-side only via service_role

CREATE TRIGGER trg_draft_campaigns_updated BEFORE UPDATE ON public.draft_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_conversation_sessions_updated BEFORE UPDATE ON public.conversation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
