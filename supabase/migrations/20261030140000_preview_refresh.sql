-- Linkul de previzualizare Meta expiră după câteva ore; îl refacem la deschiderea paginii /p/<cod>.
alter table public.campaign_previews add column if not exists preview_refreshed_at timestamptz;
notify pgrst, 'reload schema';
