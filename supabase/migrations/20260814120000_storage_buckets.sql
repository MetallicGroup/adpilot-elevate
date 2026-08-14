-- Bucket-urile de storage folosite de AdPilot nu existau în proiect (erau doar
-- rămășițe de la aplicația anterioară). Fără ele, upload-ul media eșua silențios
-- → pozele/clipurile trimise pe WhatsApp nu se salvau (media_path rămânea null),
-- iar agentul nu găsea imaginea pentru reclamă.
--   * wa-media  — media primită pe WhatsApp (poze/clipuri/audio de la clienți)
--   * ad-media  — creative generate (imagini AI pentru reclame)
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('wa-media', 'wa-media', false, 104857600),
  ('ad-media', 'ad-media', false, 104857600)
on conflict (id) do nothing;
