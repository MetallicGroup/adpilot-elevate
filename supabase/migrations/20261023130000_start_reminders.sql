-- Reamintiri pe WhatsApp (șablonul `continua_inregistrarea`) pentru cei care s-au oprit în /start.
alter table public.onboarding_sessions add column if not exists reminder_count int not null default 0;
alter table public.onboarding_sessions add column if not exists reminder_last_at timestamptz;
