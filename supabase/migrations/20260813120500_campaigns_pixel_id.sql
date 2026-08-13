-- Sales/Conversions campaigns optimize for the Purchase event on the client's
-- own website, so we record which Meta Pixel the campaign was published against.
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS pixel_id text;
