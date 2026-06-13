
# Integrare WhatsApp Business + AI Agent

## 1. Conectare WhatsApp (Meta Cloud API)

Pagină nouă **Settings → WhatsApp** unde userul introduce:
- **Phone Number ID** (din Meta Business → WhatsApp → API Setup)
- **WhatsApp Business Account ID (WABA ID)**
- **Permanent Access Token** (system user token cu permisiuni `whatsapp_business_messaging` + `whatsapp_business_management`)
- Verify token pentru webhook (generat automat de noi)

Tabel nou `whatsapp_connections`: user_id, phone_number_id, waba_id, display_phone, access_token (encrypted), verify_token, status, last_message_at.

În UI afișăm și URL-ul webhook + verify token-ul pe care trebuie să-l lipească în Meta Dashboard → WhatsApp → Configuration.

## 2. Webhook receiver

`src/routes/api/public/whatsapp/webhook.ts`:
- **GET**: hub.challenge verification (pe baza verify_token din DB după phone_number_id)
- **POST**: verify `x-hub-signature-256` cu app_secret, parsează mesaje (text/image/video/audio), descarcă media de pe Meta Graph și salvează în storage bucket `wa-media`, apoi cheamă agent-ul AI.

Tabel `whatsapp_messages`: user_id, wa_message_id, direction (in/out), type, text, media_url, role (user/assistant/tool), created_at. Folosit ca memoria conversației.

## 3. AI Agent (Lovable AI Gateway)

Server function `chatWithAgent` care:
- Încarcă ultimele ~30 mesaje din `whatsapp_messages` ca history
- Folosește `streamText` (google/gemini-3-flash-preview) cu **tools**:
  - `list_campaigns()` — campaniile userului + status + buget
  - `get_campaign_insights(campaign_id)` — spend/leads/CPL ultimele N zile
  - `pause_campaign(id)` / `resume_campaign(id)` — call la Meta Graph
  - `update_campaign_budget(id, daily_budget_ron)`
  - `generate_ad_copy(product_description, tone)` — headline + primary text + description cu emoji-uri relevante (folosește AI-ul intern)
  - `create_campaign(name, objective, daily_budget, copy, creative_media_id, page_id)` — full flow Meta (campaign → adset → creative → ad), pornit pe PAUSED by default cu confirm prin mesaj
  - `get_recent_leads(limit)`
- System prompt în română: marketer expert, proactiv, dă insights nu doar răspunde, sugerează optimizări când vede CPL mare/spend zero, confirmă acțiunile destructive înainte de execuție.
- Când userul trimite poză/video → salvate în `wa-media`, devin disponibile ca `latest_creative` pentru `create_campaign`.

Răspunsurile agentului se trimit înapoi prin Meta Graph `/messages` (suport text + image din storage).

## 4. Notificări lead-uri pe WhatsApp

Modific `meta-webhook` (cel existent care primește leadgen): după ce salvează lead-ul, dacă userul are `whatsapp_connections` activ, trimite mesaj formatat:
> 🎯 Lead nou — Campania *X*
> 👤 Ion Popescu
> 📞 0712...
> 💬 "Vreau ofertă"
> 
> Răspunde aici cu *"detalii"* să vezi tot lead-ul sau *"call"* să-l sunăm.

Agentul recunoaște comenzile follow-up pe leads.

## 5. UI

- **Settings → WhatsApp**: form conectare, status, webhook URL + verify token, test "trimite mesaj de test către numărul meu"
- **WhatsApp Inbox** (opțional acum): listă conversații cu preview ultim mesaj, click → fereastră tip chat unde vezi conversația AI ↔ user. Util pentru debug/transparență.

## 6. Secrets necesare

Avem deja `META_APP_SECRET` (refolosit pentru semnătură webhook) și `META_API_VERSION`. Trebuie:
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN_FALLBACK` (opțional, default per-user din DB) — nu e strict necesar dacă citim din DB.

Nu cer secrets noi acum — totul vine de la user prin UI.

## Detalii tehnice

- **Storage**: bucket nou `wa-media` (private), policies: user vede doar fișierele cu `metadata->>user_id = auth.uid()`.
- **Encryption token**: pentru simplitate la început îl stocăm plain (RLS scoped la owner) ca și `meta_connections.access_token` care e deja așa. Pot trece pe pgsodium ulterior dacă vrei.
- **Rate limiting Meta**: cache `list_campaigns` 30s în memorie per request.
- **Agent loop**: `stopWhen: stepCountIs(50)`, fiecare tool result revine în context.
- **Limbă**: agentul detectează limba primului mesaj, default română.

## Ce livrez în prima iterație

1. DB: `whatsapp_connections`, `whatsapp_messages`, bucket `wa-media` + RLS
2. Webhook public `/api/public/whatsapp/webhook` (verify + receive + send media handling)
3. Agent server function cu toate tool-urile listate
4. Pagina Settings → WhatsApp cu form conectare + webhook URL afișat
5. Integrare în `meta-webhook` pentru notificare lead → WhatsApp
6. Pagina simplă WhatsApp Inbox (read-only) pentru debug

După ce userul conectează și testează, iterăm pe UX agent (tonalitate, ce insights proactive, frecvență sugestii).

## Întrebare înainte să încep

Vrei ca agentul să **execute direct** acțiuni de buget/start/pauză, sau să-ți **ceară confirmare** pe WhatsApp înainte (răspunzi "da")? Recomand confirmare pentru: create campaign nouă și schimbări buget >20%. Restul direct.
