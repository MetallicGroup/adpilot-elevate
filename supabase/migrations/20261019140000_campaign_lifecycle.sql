-- Ciclul de după lansare: aprobare / respingere / primele afișări, anunțate o singură dată pe WhatsApp.
alter table public.campaigns add column if not exists review_state text;
alter table public.campaigns add column if not exists review_reason text;
alter table public.campaigns add column if not exists live_notified_at timestamptz;
alter table public.campaigns add column if not exists rejected_notified_at timestamptz;
alter table public.campaigns add column if not exists stalled_notified_at timestamptz;
-- Campaniile existente nu primesc retroactiv mesajul „a început să ruleze”.
update public.campaigns set live_notified_at = now() where live_notified_at is null;
notify pgrst, 'reload schema';
