-- TikTok Marketing API: conexiunea unui user + conturile de reclame (advertisers).
-- Tokenul rămâne vizibil doar pentru service_role.

CREATE TABLE IF NOT EXISTS public.tiktok_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text,
  scopes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT (id, user_id, scopes, is_active, created_at, updated_at) ON public.tiktok_connections TO authenticated;
GRANT ALL ON public.tiktok_connections TO service_role;

ALTER TABLE public.tiktok_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tiktok connections" ON public.tiktok_connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER tiktok_connections_touch
  BEFORE UPDATE ON public.tiktok_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.tiktok_advertisers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.tiktok_connections(id) ON DELETE CASCADE,
  advertiser_id text NOT NULL,
  advertiser_name text,
  currency text,
  timezone text,
  status text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, advertiser_id)
);

GRANT SELECT ON public.tiktok_advertisers TO authenticated;
GRANT ALL ON public.tiktok_advertisers TO service_role;

ALTER TABLE public.tiktok_advertisers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tiktok advertisers" ON public.tiktok_advertisers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER tiktok_advertisers_touch
  BEFORE UPDATE ON public.tiktok_advertisers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

NOTIFY pgrst, 'reload schema';
