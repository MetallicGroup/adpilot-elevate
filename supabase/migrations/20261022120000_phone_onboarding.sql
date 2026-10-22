-- Onboarding nou: cont pe bază de număr de telefon (cod pe WhatsApp), întrebări,
-- poze, conectare Facebook/TikTok și clipul demo gratuit livrat pe WhatsApp.

-- Coduri de autentificare trimise pe WhatsApp (șablonul `cod_verificare`).
-- Doar service role are acces (RLS fără politici).
create table if not exists public.phone_otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists phone_otps_phone_created_idx on public.phone_otps (phone, created_at desc);
create index if not exists phone_otps_ip_created_idx on public.phone_otps (ip, created_at desc);
alter table public.phone_otps enable row level security;

-- Starea onboarding-ului nou, câte un rând per cont.
create table if not exists public.onboarding_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  niche text,
  goal text check (goal is null or goal in ('calls', 'forms', 'web', 'shop')),
  photo_paths text[] not null default '{}',
  -- platformele alese pentru reclame: 'fb', 'tt'
  targets text[] not null default '{}',
  -- none | queued | running | ready | failed | delivered
  demo_status text not null default 'none',
  demo_job jsonb not null default '{}'::jsonb,
  demo_video_path text,
  demo_image_paths text[] not null default '{}',
  demo_error text,
  demo_lock_until timestamptz,
  demo_started_at timestamptz,
  demo_ready_at timestamptz,
  template_sent_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.onboarding_sessions enable row level security;
drop policy if exists "onboarding_sessions_select_own" on public.onboarding_sessions;
create policy "onboarding_sessions_select_own" on public.onboarding_sessions
  for select to authenticated using (auth.uid() = user_id);

create index if not exists onboarding_sessions_demo_idx
  on public.onboarding_sessions (demo_status) where demo_status in ('queued', 'running', 'ready');

-- Pozele încărcate la onboarding și materialele generate. Bucket privat:
-- fiecare user scrie/citește doar în folderul lui (<user_id>/...).
insert into storage.buckets (id, name, public)
values ('onboarding', 'onboarding', false)
on conflict (id) do nothing;

drop policy if exists "onboarding_upload_own" on storage.objects;
create policy "onboarding_upload_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'onboarding' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "onboarding_read_own" on storage.objects;
create policy "onboarding_read_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'onboarding' and (storage.foldername(name))[1] = auth.uid()::text);
