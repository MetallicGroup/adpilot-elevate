# Cele 4 obiective devin 4 tipuri reale de campanie, cu onboarding dedicat

Astăzi „Tu ce vrei să obții?" de pe home page doar salvează o alegere și duce în wizard. Planul transformă alegerea într-un traseu complet: home page → sign up → onboarding specific obiectivului → campanie live.

## Cele 4 trasee

| Obiectiv | Ce construiește AdPilot | Unde ajunge clientul |
|---|---|---|
| Vânzări | Campanie de conversii pe Pixel-ul existent al magazinului | Site-ul lor |
| Programări | Landing page de booking generat de AI + eveniment SCHEDULE | Pagina AdPilot (`/b/slug`) |
| Clienți potențiali | Landing page de lead (aceeași bază, formular scurt) sau formular Meta | Pagina AdPilot |
| Apeluri | Campanie „Sună acum" cu numărul completat automat | Telefonul lor |

## Onboarding pe obiectiv

După sign up, utilizatorul intră într-un onboarding cu pașii comuni (Meta, plan, WhatsApp) urmați de un pas nou: **Configurare obiectiv**, diferit pentru fiecare traseu.

- **Vânzări** — detectăm automat Pixel-urile din contul Meta (`act_<id>/adspixels`, deja disponibil cu `ads_read`). Dacă există unul activ, îl afișăm ca „găsit, gata de folosit"; dacă nu, oferim un snippet de instalare sau trecerea pe traseul de landing page. Nu întrebăm niciodată „ai pixel?".
- **Programări** — pornim constructorul de landing page (mai jos).
- **Clienți potențiali** — aceleași ecrane ca la programări, dar fără calendar: doar întrebările de calificare.
- **Apeluri** — un singur ecran: numărul de telefon (precompletat din pagina de Facebook, dacă îl găsim), oraș, program de disponibilitate. AI-ul scrie restul.

Alegerea de pe home page se transmite prin `search param` la `/auth` și mai departe la `/onboarding`, deci utilizatorul nu re-alege nimic.

## Constructorul de landing page — cum îl văd

Nu un builder cu drag & drop. Utilizatorul-țintă nu vrea să construiască o pagină, vrea să aibă una. Propunerea:

**1. Trei întrebări, nu un editor.**
Ce serviciu oferi? În ce oraș? Ai o ofertă de start? Atât. Din astea AI-ul (Gemini prin gateway) generează headline, subheadline, beneficii, secțiune despre, FAQ, CTA și întrebările de calificare potrivite nișei.

**2. Preview live, editare prin click.**
Pagina generată apare imediat în dreapta, într-un cadru de telefon. Orice text se editează cu click direct pe el (inline, fără panouri). Structura secțiunilor e fixă și optimizată pentru conversie — asta e valoarea, nu libertatea de aranjare.

**3. Regenerare pe bucăți.**
Lângă fiecare secțiune, un buton „altă variantă". Utilizatorul nu scrie prompturi, doar cere alta până îi place.

**4. Imagine hero.**
Trage o poză proprie sau generăm una cu AI din descrierea serviciului (disponibil pe Pro/Premium, conform planurilor).

**5. Publicare într-un click.**
Slug generat automat (`adpilot.ro/b/salon-eleganta-cluj`), pagina e SSR și rapidă, pixel + CAPI atașate automat.

## Același constructor pe WhatsApp

Toată configurarea se poate face conversațional. Agentul întreabă pe rând: serviciu, oraș, ofertă, buget. Generează pagina, trimite link-ul de preview, iar utilizatorul răspunde „ok" sau „schimbă titlul". La confirmare, campania pornește și primește link-ul final. Aceleași funcții de server ca în interfață — o singură sursă de adevăr, doar altă suprafață.

## Detalii tehnice

- Extindem `booking_campaigns` într-un model generic de campanie cu landing page: câmp `objective` (`sales` / `bookings` / `leads` / `calls`) care controlează ce secțiuni se randează în `/b/$slug` și ce eveniment CAPI se trimite (`Schedule`, `Lead`, `Contact`).
- Pas nou de onboarding: `src/routes/_authenticated/onboarding.tsx` primește un al 4-lea pas care randează un component per obiectiv, sub `src/components/onboarding/goal/*`.
- Detectarea Pixel: server function nouă care listează `adspixels` și starea lor.
- Constructor: `src/components/landing-builder/*` — formular scurt + preview inline editabil, alimentat de o extensie a `src/lib/booking/ai.server.ts`.
- WhatsApp: intenții noi în `src/lib/whatsapp/intent-router.ts` pentru fluxul de configurare pas cu pas, apelând aceleași funcții.
- Wizard-ul existent din `/create` rămâne pentru utilizatorii care vor control manual.

## Ordinea de lucru propusă

1. Model de date generic + rutare obiectiv din home page până în onboarding
2. Pasul de onboarding pentru Apeluri și Vânzări (cele mai simple)
3. Constructorul de landing page cu preview editabil (Programări + Lead-uri)
4. Fluxul conversațional pe WhatsApp
