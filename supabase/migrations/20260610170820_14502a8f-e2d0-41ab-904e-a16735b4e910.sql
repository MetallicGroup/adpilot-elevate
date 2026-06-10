
-- meta_connections
CREATE TABLE public.meta_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  meta_user_id text NOT NULL,
  meta_user_name text,
  access_token text,
  token_expires_at timestamptz,
  scopes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, meta_user_id)
);

GRANT SELECT (id, user_id, meta_user_id, meta_user_name, scopes, is_active, created_at, updated_at) ON public.meta_connections TO authenticated;
GRANT DELETE ON public.meta_connections TO authenticated;
GRANT ALL ON public.meta_connections TO service_role;

ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own meta connections" ON public.meta_connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own meta connections" ON public.meta_connections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER meta_connections_touch
  BEFORE UPDATE ON public.meta_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- meta_ad_accounts
CREATE TABLE public.meta_ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  ad_account_id text NOT NULL,
  account_name text,
  currency text,
  timezone_name text,
  status integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, ad_account_id)
);

GRANT SELECT, UPDATE, DELETE ON public.meta_ad_accounts TO authenticated;
GRANT ALL ON public.meta_ad_accounts TO service_role;

ALTER TABLE public.meta_ad_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own meta ad accounts" ON public.meta_ad_accounts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER meta_ad_accounts_touch
  BEFORE UPDATE ON public.meta_ad_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- meta_pages (Facebook pages — required for Lead Ads)
CREATE TABLE public.meta_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  page_id text NOT NULL,
  page_name text,
  page_access_token text,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, page_id)
);

GRANT SELECT (id, user_id, connection_id, page_id, page_name, category, is_active, created_at, updated_at) ON public.meta_pages TO authenticated;
GRANT DELETE ON public.meta_pages TO authenticated;
GRANT ALL ON public.meta_pages TO service_role;

ALTER TABLE public.meta_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own meta pages" ON public.meta_pages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own meta pages" ON public.meta_pages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER meta_pages_touch
  BEFORE UPDATE ON public.meta_pages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
