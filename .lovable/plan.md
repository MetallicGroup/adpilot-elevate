
# Extindere agent WhatsApp AdPilot

## 1. Alertă lead instant (push, nu pull)
- În `src/routes/api/public/meta.webhook.ts` (handler leadgen): după ce inserăm lead-ul în DB, dacă userul are `whatsapp_connections.status = 'active'`, trimitem imediat un mesaj WhatsApp formatat:
  > 🎯 **Lead nou** — *{campanie}*
  > 👤 {nume}
  > 📞 {telefon}
  > 💬 {primul răspuns custom, dacă există}
  >
  > Răspunde *"sună"* să-l contactăm sau *"detalii"* pentru tot formularul.
- Folosim `sendWhatsAppMessage` (central) din `whatsapp.server.ts`.
- Eșec silent (try/catch + log) — nu blocăm webhook-ul Meta.

## 2. Raport zilnic 09:00
- Server route public `src/routes/api/public/hooks/daily-report.ts` (POST, verifică `apikey` header = anon key).
- Iterează userii cu WhatsApp conectat + Meta conectat, pentru fiecare:
  - Cheamă insights ultimele 24h (impressions, click-uri, leaduri, cheltuit).
  - Compune mesaj în română simplă, fără jargon:
    > 📊 **Raport ieri**
    > • Ai cheltuit **{x} lei**
    > • Ai primit **{n} clienți noi**
    > • Fiecare client te-a costat **{y} lei**
    > • Cea mai bună reclamă: *{nume}* — {n} clienți
    >
    > {1 propunere acționabilă în limbaj simplu}
- Cron job în Supabase via `pg_cron` + `pg_net` la `0 6 * * *` UTC (= 09:00 RO vara).

## 3. Anomalii cu auto-fix
- Același cron rulează verificări la fiecare oră (sau separat la `15 * * * *`):
  - Spend zero >12h pe campanie ACTIVE → "Reclama ta «X» nu a cheltuit nimic azi. Probabil e prea îngustă sau e oprită."
  - Cost per client x2 față de media 7 zile → "Clienții te costă **dublu** azi față de săptămâna trecută la «X»."
  - CTR sub 0.5% → "Foarte puțină lume dă click pe «X». Probabil poza/textul nu mai prind."
- Mesajul se termină cu: "Vrei să rezolv eu? Răspunde **da**."
- În agent (`whatsapp-agent.server.ts`):
  - Detectăm dacă ultimul mesaj outbound a fost o propunere de anomalie (marker în DB — coloană nouă `whatsapp_messages.meta jsonb` cu `{anomaly_action: {...}}`).
  - La răspuns "da/ok/rezolvă", agentul execută acțiunea propusă (pause, lărgire targeting, schimbare buget) — fără confirmare nouă.

## 4. Tool-uri noi pentru agent
În `src/lib/whatsapp-agent.server.ts` adăugăm:
- `duplicate_campaign({ campaign_id, new_name?, new_copy? })` — citește campania existentă, recreează cu copy nou și pornește pe PAUSED.
- `ab_test_creative({ campaign_id, media_ids: [a, b] })` — creează 2 ad-uri în același adset, nume "A" / "B".
- `change_targeting({ campaign_id, age_min?, age_max?, cities?, genders? })` — PATCH pe adset existent.
- `blacklist_placement({ campaign_id, exclude: ["audience_network" | "stories" | ...] })` — update `publisher_platforms` / `facebook_positions`.
- `reply_to_lead({ lead_id, text })` — trimite mesaj WhatsApp către lead-ul respectiv (doar dacă `lead.phone` și consimțământ înregistrat; verifică fereastra 24h Meta — dacă expirat, refuză cu explicație).
- `get_invoice({ month? })` — Graph API `act_{id}/transactions` ultima lună, returnează link / sumă.
- Helpers Meta corespunzători în `meta-publish.server.ts`.

## 5. Generare poze statice AI
- Tool nou `generate_creative_image({ prompt, brand_colors? })` în agent.
- Implementare: chemă Lovable AI Gateway `/v1/images/generations` cu `google/gemini-2.5-flash-image` (sau `nano-banana`), salvează rezultat în bucket `wa-media`, returnează URL + media_id WA pentru preview imediat clientului.
- Agentul propune: "Nu ai poză? Pot să-ți generez una. Descrie-mi produsul."

## 6. Mesaje vocale (voice notes)
- În `src/routes/api/public/whatsapp.webhook.ts`: tratăm `messages[].type === 'audio'`.
- Descărcăm fișierul WA (deja avem `downloadWhatsAppMedia`), trimitem la Lovable AI Gateway `/v1/chat/completions` cu `google/gemini-2.5-flash` și `input_audio` (format webm/ogg) → transcriere.
- Tratam transcriptul ca text user normal în agent loop.
- Salvăm și audio-ul în `wa-media` pentru istoric, plus `text` cu transcriptul + prefix "🎙️ ".

## Detalii tehnice rapide
- **Migrație DB**: 
  - `whatsapp_messages` + coloană `meta jsonb` (anomaly actions, audio refs).
  - `campaigns` + coloană `last_anomaly_check_at timestamptz`.
- **Cron**: 2 joburi noi (`adpilot-daily-report` la 06:00 UTC, `adpilot-anomaly-scan` la fiecare oră).
- **Limbaj**: toate mesajele automate în română, fără termeni gen "CPL", "CTR", "ROAS" — folosim "cost per client", "câți dau click", "cât scoți la 1 leu investit".

## Ce nu fac acum
- Calendar/Stripe/Shopify/TikTok/Twilio — în alt round, după ce confirmi că ce e mai sus merge.
- UI dedicat anomalii — totul prin chat WhatsApp.

Confirmi planul ca să încep să implementez?
