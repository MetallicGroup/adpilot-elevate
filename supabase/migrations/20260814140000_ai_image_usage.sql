-- Contor pentru limita lunară de poze AI per plan (Starter=0, Pro=10, Premium=nelimitat).
create table if not exists public.ai_image_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_image_usage_user_month on public.ai_image_usage (user_id, created_at);
alter table public.ai_image_usage enable row level security;
