-- Codul face upsert cu onConflict pe chei care nu existau ca și constrângeri
-- unice → upsert-ul arunca eroare (deseori prinsă silențios în catch), iar
-- datele nu se salvau. Adăugăm constrângerile lipsă:
--   * performance_data(campaign_id,date) — snapshot zilnic per campanie (insights/rapoarte)
--   * whatsapp_connections(user_id)       — o conexiune per user
--   * leads(platform,external_lead_id)     — dedup lead-uri din webhook Meta
--                                            (NULL-urile rămân distincte → lead-uri
--                                             fără external_lead_id nu sunt afectate)
alter table public.performance_data
  add constraint performance_data_campaign_date_key unique (campaign_id, date);

alter table public.whatsapp_connections
  add constraint whatsapp_connections_user_id_key unique (user_id);

alter table public.leads
  add constraint leads_platform_external_lead_id_key unique (platform, external_lead_id);
