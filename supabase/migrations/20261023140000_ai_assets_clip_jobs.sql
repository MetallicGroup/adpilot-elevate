-- Istoricul materialelor generate cu AI (pagina „Materiale”) și clipurile noi cerute
-- după înscriere (din WhatsApp sau din aplicație), cu limită lunară pe plan.

create table if not exists public.ai_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('image', 'video')),
  bucket text not null,
  path text not null,
  -- onboarding | whatsapp | web
  source text not null default 'whatsapp',
  prompt text,
  job_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists ai_assets_user_idx on public.ai_assets (user_id, created_at desc);
alter table public.ai_assets enable row level security;
drop policy if exists "ai_assets_select_own" on public.ai_assets;
create policy "ai_assets_select_own" on public.ai_assets for select to authenticated using (auth.uid() = user_id);

-- Aceleași coloane demo_* ca în onboarding_sessions: același pipeline le procesează pe amândouă.
create table if not exists public.ai_clip_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- whatsapp | web
  source text not null default 'whatsapp',
  niche text,
  goal text,
  brief text,
  -- [{ "bucket": "...", "path": "..." }]
  photo_refs jsonb not null default '[]'::jsonb,
  demo_status text not null default 'queued',
  demo_job jsonb not null default '{}'::jsonb,
  demo_video_path text,
  demo_image_paths text[] not null default '{}',
  demo_error text,
  demo_lock_until timestamptz,
  demo_started_at timestamptz not null default now(),
  demo_ready_at timestamptz,
  template_sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_clip_jobs_user_idx on public.ai_clip_jobs (user_id, created_at desc);
create index if not exists ai_clip_jobs_active_idx on public.ai_clip_jobs (demo_status) where demo_status in ('queued', 'running', 'ready');
alter table public.ai_clip_jobs enable row level security;
drop policy if exists "ai_clip_jobs_select_own" on public.ai_clip_jobs;
create policy "ai_clip_jobs_select_own" on public.ai_clip_jobs for select to authenticated using (auth.uid() = user_id);
