-- Pixelul TikTok al clientului pe pagina AdPilot (campanii TikTok cu destinație site).
alter table public.booking_campaigns add column if not exists tiktok_pixel_code text;
alter table public.booking_campaigns add column if not exists tiktok_pixel_id text;
notify pgrst, 'reload schema';
