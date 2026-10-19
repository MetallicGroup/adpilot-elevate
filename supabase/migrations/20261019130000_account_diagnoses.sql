-- Diagnosticul contului (segment + ce lipsește + istoric 90 zile), calculat pe server.
create table if not exists public.account_diagnoses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  segment text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.account_diagnoses enable row level security;
grant all on public.account_diagnoses to service_role;
grant select on public.account_diagnoses to authenticated;
drop policy if exists "Users view own diagnosis" on public.account_diagnoses;
create policy "Users view own diagnosis" on public.account_diagnoses
  for select to authenticated using (auth.uid() = user_id);
notify pgrst, 'reload schema';
