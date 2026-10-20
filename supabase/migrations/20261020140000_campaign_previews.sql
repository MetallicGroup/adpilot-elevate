-- Ciorne de campanie create de asistent: setările confirmate + media deja încărcată la Meta.
-- Linkul public /p/<code> arată previzualizarea; la „Da” se publică exact ciorna.
create table if not exists public.campaign_previews (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  media jsonb not null,
  preview_url text,
  page_name text,
  status text not null default 'ready',
  campaign_row_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists campaign_previews_user on public.campaign_previews (user_id, created_at desc);
alter table public.campaign_previews enable row level security;
grant all on public.campaign_previews to service_role;
notify pgrst, 'reload schema';
