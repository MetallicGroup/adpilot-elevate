# Flow nou „Programări” (înlocuiește „Click-uri pe link”)

## Ce există azi (analiza codului real)

**Unde se alege obiectivul — 3 locuri diferite, nu unul:**

1. `src/routes/_authenticated/create.tsx` — wizardul manual. `type Objective = "LEAD_GENERATION" | "CONVERSIONS"`; cardurile de la pasul 1 (liniile ~389-410) sunt „Generare lead-uri" și „Conversii". „Conversii" e de fapt flow-ul de trafic pe site: cere `landing_url`, nu creează lead form.
2. `src/components/wizard/CampaignLauncher.tsx` — launcher-ul simplu, alege `PromotionGoal` din `PROMOTION_GOALS` (`src/lib/launcher/presets.ts`). `appointments` există deja ca prima opțiune („Mai multe programări"), dar azi produce exact același lead form Meta ca `leads`.
3. `src/lib/whatsapp-agent.server.ts` — tool-ul `create_campaign` cu `objective: "leads" | "traffic"`; `traffic` cere `landing_url`.

**Publicare Meta (`src/lib/meta-publish.server.ts`):**
- `createCampaign(..., objective: "OUTCOME_LEADS" | "OUTCOME_TRAFFIC")`
- `createAdSet(...)`: `optimization_goal = traffic ? "LINK_CLICKS" : "LEAD_GENERATION"`, `destination_type = "WEBSITE" | "ON_AD"`, `promoted_object = {page_id}` doar pe lead gen.
- Nu există nicăieri Pixel / dataset / CAPI. Zero infrastructură de conversii.

**Ce reutilizăm:** `BusinessNiche` + `PROMOTION_GOALS` + `getNicheAudience` (extindem, nu duplicăm), `LauncherSimpleAnswers`/`GeneratedAdCopy`, `launch.service.ts`, `copy-generator.ts` (Lovable AI), `campaigns`/`leads`/`performance_data`, conexiunile Meta, agentul WhatsApp, `meta-insights`.

## Ce se schimbă

- `CONVERSIONS` din `create.tsx` și `traffic` din launcher devin **„Programări"**. `LEAD_GENERATION` / „Clienți potențiali" rămâne neatins.
- `objective: "traffic"` rămâne **doar** în agentul WhatsApp ca fallback intern (campanii vechi continuă să funcționeze), dar nu mai e expus ca alegere în UI.

## Meta: ce obiectiv folosim și de ce

`OUTCOME_LEADS` + `optimization_goal: OFFSITE_CONVERSIONS` + `destination_type: WEBSITE`, cu `promoted_object = { pixel_id, custom_event_type: "SCHEDULE" }`.

De ce nu `OUTCOME_TRAFFIC`/`LINK_CLICKS`: optimizează pe clicuri ieftine, nu pe programări. Cu Schedule ca eveniment de conversie, algoritmul învață exact pe KPI-ul nostru. Până la ~30-50 conversii/săpt. pornim adset-ul pe `LANDING_PAGE_VIEWS` și comutăm automat pe `OFFSITE_CONVERSIONS` când pragul e atins (job pe cronul existent).

Pixel: creăm automat un dataset per ad account la prima campanie de programări (`/act_X/adspixels`) și îl salvăm. Landing page-ul trimite `PageView` + `Schedule` din browser, iar serverul trimite același `Schedule` prin CAPI cu `event_id` identic (dedup), plus `fbclid`→`fbc`, `fbp`, hash SHA-256 pe telefon/email.

## Schema DB nouă

```text
business_profiles      (1 per user) name, niche, niche_custom, city, phone, logo_url,
                        brand_colors, description, timezone, privacy_policy_url
booking_campaigns      (N per business) — o „ofertă" = un landing page
                        slug, service, offer, headline/copy JSONB, status,
                        campaign_id -> campaigns.id, meta_* ids, pixel_id
booking_questions      booking_campaign_id, position, key, label, type, options[],
                        required, source ('preset'|'ai'|'user'), scoring_weight JSONB
booking_services       booking_campaign_id, name, duration_min, price, description
booking_availability   business_id, weekday, start_time, end_time, slot_min, buffer_min
booking_blackouts      business_id, date range
bookings               booking_campaign_id, service_id, slot_start/end, name, phone, email,
                        answers JSONB, qualification_score int, qualification_tier text,
                        status ('pending'|'confirmed'|'attended'|'no_show'|'won'|'lost'),
                        revenue numeric, attribution JSONB (fbclid, fbp, utm_*, ad_id,
                        adset_id, campaign_id, referrer, ip_hash, ua),
                        capi_sent_at, lead_id -> leads.id
booking_page_views     pentru rata de conversie a landing page-ului
```

`bookings.qualification_score/tier` + `booking_questions.scoring_weight` există de la început, dar rămân null până implementăm scoring-ul — fără refactor ulterior.

**Extinderi pe tabele existente:** `campaigns.campaign_type` (`'lead_form' | 'booking'`, default `'lead_form'` → compatibilitate totală), `campaigns.booking_campaign_id`, `campaigns.pixel_id`; `meta_ad_accounts.pixel_id`; `performance_data.bookings`, `.verified_bookings` (Meta nu le raportează, le agregăm noi).

## Legăturile

- întrebări → landing page: `booking_questions` se randează în wizardul de pe `/b/$slug`.
- landing page → campanie: `booking_campaigns.campaign_id` ↔ `campaigns.booking_campaign_id`.
- booking → ad: URL-ul reclamei conține `?bc={id}&fbclid=...` plus URL tags Meta (`{{ad.id}}`, `{{adset.id}}`, `{{campaign.id}}`); le salvăm în `bookings.attribution`.

## Generarea întrebărilor (hibrid)

Taxonomia se extinde în `src/lib/launcher/presets.ts` — **același** `BusinessNiche`, cu nișele noi cerute (dentist, barber, detailing, hvac, electrician, fotovoltaice, fizioterapie, avocat, contabilitate, imobiliare, fotograf, evenimente, etc.) + `other` cu text liber. Un server fn AI clasifică textul liber într-o nișă cunoscută.

`src/lib/booking/question-presets.ts` = preseturi pe nișă. Peste ele, `generateBookingQuestions` (Lovable AI, `google/gemini-3-flash`) primește `{niche, business, selected_service, offer}` și returnează JSON validat cu Zod: doar `text | textarea | single_select | multi_select | yes_no | number | date`, max 6 întrebări, default 3-5, fără nume/telefon (acelea sunt fixe la final). Ce nu trece validarea → cade pe presetul nișei. Editorul din UI e simplu: listă cu drag-to-reorder, toggle „obligatoriu", editare text/opțiuni, adaugă/șterge.

## Fișiere

**Noi:** `src/lib/booking/{types,question-presets,questions.functions,landing-generator.server,availability.ts,booking.functions,capi.server}.ts`, `src/lib/meta/pixel.server.ts`, rutele publice `src/routes/b.$slug.tsx` (SSR, mobile-first) + `src/routes/api/public/booking/submit.ts`, `src/components/booking/*`, `src/routes/_authenticated/bookings.tsx`.

**Modificate:** `create.tsx` (card „Programări" în loc de „Conversii"), `CampaignLauncher.tsx` (ramura `appointments`), `launcher/{types,presets,technical-mapper}.ts`, `meta-publish.server.ts` (obiectiv + pixel + promoted_object), `dashboard.tsx` / `campaigns.$id.tsx` (KPI = Bookings, Cost/Booking, Verified; clicks/CTR/CPC secundare), `whatsapp-agent.server.ts` (notificări la programare + „câte programări am azi").

## Etape

1. Migrație DB + taxonomie de nișe extinsă + `business_profiles` în onboarding (pas „Domeniu / Nișă" obligatoriu, prefill din datele existente).
2. Generator de întrebări (preset + AI + editor).
3. Disponibilitate + landing page `/b/$slug` generat AI + booking wizard + salvare cu atribuire.
4. Pixel + CAPI `Schedule` cu dedup, adset pe conversii.
5. KPI-uri de programări în dashboard + rapoarte WhatsApp; scoring HOT/WARM/COLD la final.

Campaniile existente `LEAD_GENERATION` nu sunt atinse în nicio etapă (`campaign_type` default `'lead_form'`).
