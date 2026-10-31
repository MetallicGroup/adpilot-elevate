-- Conturile noi create cu telefonul (/start) primesc clipul cu paywall, fără perioadă gratuită.
-- Conturile existente, agențiile și celelalte moduri de înscriere rămân pe modelul vechi.
alter table public.profiles add column if not exists paywall boolean not null default false;

alter table public.onboarding_sessions
  add column if not exists demo_preview_path text,
  add column if not exists demo_preview_image_paths text[],
  add column if not exists demo_thumb_path text,
  add column if not exists demo_unlocked_at timestamptz,
  add column if not exists demo_reminder_sent_at timestamptz;

create index if not exists onboarding_sessions_reminder_idx
  on public.onboarding_sessions (demo_ready_at)
  where demo_status = 'ready' and demo_reminder_sent_at is null;
