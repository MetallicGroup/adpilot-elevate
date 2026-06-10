ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'tiktok',
  ADD COLUMN IF NOT EXISTS meta_campaign_id text,
  ADD COLUMN IF NOT EXISTS meta_adset_id text,
  ADD COLUMN IF NOT EXISTS meta_ad_id text;

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_platform_check;
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_platform_check CHECK (platform IN ('tiktok','meta'));

CREATE INDEX IF NOT EXISTS campaigns_platform_idx ON public.campaigns(platform);