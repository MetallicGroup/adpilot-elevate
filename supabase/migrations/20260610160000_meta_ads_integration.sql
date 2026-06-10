-- Meta Ads integration tables (additive — TikTok tables unchanged)

-- Temporary OAuth state tokens (server-managed)
CREATE TABLE public.meta_oauth_states (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_meta_oauth_states_expires ON public.meta_oauth_states(expires_at);
ALTER TABLE public.meta_oauth_states ENABLE ROW LEVEL SECURITY;
-- No client policies — service_role only

CREATE TABLE public.meta_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'meta',
  meta_user_id TEXT,
  meta_user_name TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_connections TO authenticated;
GRANT ALL ON public.meta_connections TO service_role;
ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own meta connections" ON public.meta_connections
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Hide OAuth tokens from client (service_role writes only)
REVOKE SELECT (access_token, token_expires_at), INSERT (access_token, token_expires_at), UPDATE (access_token, token_expires_at)
  ON public.meta_connections FROM authenticated, anon;
GRANT SELECT, INSERT, UPDATE (provider, meta_user_id, meta_user_name) ON public.meta_connections TO authenticated;

CREATE TABLE public.meta_ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  account_name TEXT,
  currency TEXT,
  timezone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, ad_account_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ad_accounts TO authenticated;
GRANT ALL ON public.meta_ad_accounts TO service_role;
ALTER TABLE public.meta_ad_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own meta ad accounts" ON public.meta_ad_accounts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.meta_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_account_id UUID NOT NULL REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  meta_campaign_id TEXT,
  meta_adset_id TEXT,
  meta_ad_id TEXT,
  meta_form_id TEXT,
  page_id TEXT,
  campaign_name TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT 'OUTCOME_LEADS',
  daily_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PAUSED',
  business_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  creative JSONB NOT NULL DEFAULT '{}'::jsonb,
  targeting JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_campaigns TO authenticated;
GRANT ALL ON public.meta_campaigns TO service_role;
ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own meta campaigns" ON public.meta_campaigns
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.meta_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.meta_campaigns(id) ON DELETE SET NULL,
  platform_lead_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform_lead_id)
);
CREATE INDEX idx_meta_leads_campaign ON public.meta_leads(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_leads TO authenticated;
GRANT ALL ON public.meta_leads TO service_role;
ALTER TABLE public.meta_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own meta leads" ON public.meta_leads
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.meta_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.meta_campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  ctr NUMERIC(8,4) NOT NULL DEFAULT 0,
  cpc NUMERIC(12,2) NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  cpl NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, date)
);
CREATE INDEX idx_meta_perf_campaign_date ON public.meta_performance(campaign_id, date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_performance TO authenticated;
GRANT ALL ON public.meta_performance TO service_role;
ALTER TABLE public.meta_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own meta performance" ON public.meta_performance
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_meta_connections_updated BEFORE UPDATE ON public.meta_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_meta_campaigns_updated BEFORE UPDATE ON public.meta_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT ALL ON public.meta_oauth_states TO service_role;
