-- Closer (nivelul 1): ce i-am trimis patronului despre fiecare lead — reamintirea de la 10 minute,
-- întrebarea „A venit?” de a doua zi și răspunsul lui (butoanele din WhatsApp).
alter table public.leads add column if not exists followup jsonb not null default '{}'::jsonb;
notify pgrst, 'reload schema';
