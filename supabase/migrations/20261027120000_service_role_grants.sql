-- Tabelele create recent nu primiseră drepturi pentru service_role (serverul aplicației),
-- așa că inserările din /start (coduri, onboarding, clipuri, poze AI) eșuau.
grant all on table public.phone_otps, public.onboarding_sessions, public.ai_assets, public.ai_clip_jobs, public.ai_image_usage to service_role;
notify pgrst, 'reload schema';
