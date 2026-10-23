-- Onboarding pe telefon: acordul pentru mesaje WhatsApp, păstrat ca dovadă (GDPR),
-- și excluderea conturilor noi din seria veche de emailuri „conectează Facebook”.

alter table public.phone_otps add column if not exists consent_text text;

alter table public.profiles add column if not exists whatsapp_consent_at timestamptz;
alter table public.profiles add column if not exists whatsapp_consent_ip text;
alter table public.profiles add column if not exists whatsapp_consent_text text;

-- Seria de reactivare pe email: doar conturile vechi (email real, fără Facebook și fără TikTok).
-- Conturile din onboarding-ul nou (/start) au pașii lor și reamintirea pe WhatsApp.
create or replace function public.get_activation_candidates()
 returns table(user_id uuid, email text, full_name text, activation_step integer)
 language sql
 security definer
 set search_path to 'public'
as $function$
  select p.id, u.email::text, p.full_name, p.activation_step
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email_confirmed_at is not null
    and u.email is not null
    and u.email not ilike '%@phone.adpilot.ro'
    and u.email not ilike '%@pending.adpilot.ro'
    and u.created_at <= now() - interval '24 hours'
    and u.created_at >= now() - interval '7 days'
    and p.activation_step < 3
    and (p.activation_last_sent_at is null or p.activation_last_sent_at < now() - interval '22 hours')
    and not exists (select 1 from public.meta_connections mc where mc.user_id = p.id and mc.is_active = true)
    and not exists (select 1 from public.tiktok_connections tc where tc.user_id = p.id and tc.is_active = true)
    and not exists (select 1 from public.onboarding_sessions os where os.user_id = p.id)
  order by u.created_at asc
  limit 200;
$function$;
