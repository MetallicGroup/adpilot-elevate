-- Mesajele complete păstrate cât fereastra de 24h e închisă; se trimit când patronul răspunde.
create table if not exists public.wa_pending_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  text text not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index if not exists wa_pending_notifications_user_open
  on public.wa_pending_notifications (user_id, created_at) where delivered_at is null;
alter table public.wa_pending_notifications enable row level security;
grant all on public.wa_pending_notifications to service_role;
notify pgrst, 'reload schema';
