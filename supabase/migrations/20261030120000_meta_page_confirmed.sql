-- Pagina de Facebook pe care facem reclame: aleasă automat la conectare, confirmată de om
-- când are mai multe pagini (botul îl întreabă cu butoane).
alter table public.meta_connections add column if not exists page_confirmed_at timestamptz;
notify pgrst, 'reload schema';
