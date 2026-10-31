import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { Band, CardGrid } from "@/components/v2/kit";

export const Route = createFileRoute("/documentation")({
  head: () => ({ meta: [
    { title: "Documentație — AdPilot" },
    { name: "description", content: "Documentația produsului: primii pași, creare campanii, integrări și mai mult." },
    { property: "og:title", content: "Documentație — AdPilot" },
    { property: "og:description", content: "Documentația produsului: primii pași, creare campanii, integrări și mai mult." },
    { property: "og:url", content: "https://adpilot.ro/documentation" },
  ], links: [{ rel: "canonical", href: "https://adpilot.ro/documentation" }] }),
  component: Documentation,
});

const sections = [
  {
    title: "1. Primii pași",
    items: [
      { id: "creeaza-cont", h: "Creează-ți contul", body: "Apasă „Începe gratuit” pe adpilot.ro și introdu numărul tău de WhatsApp. Primești un cod pe WhatsApp, răspunzi la două întrebări despre afacere și trimiți 2–3 poze. Din acel moment ai cont; conturile vechi cu email sau Google rămân valabile." },
      { id: "conecteaza", h: "Conectează contul de reclame", body: "Conectezi Facebook (Meta), TikTok sau ambele, din onboarding sau din Setări → Conexiuni. Vei fi redirecționat către ecranul OAuth oficial al platformei, unde alegi ce cont de reclame să partajezi cu AdPilot. Poți revoca accesul oricând." },
      { id: "prima-campanie", h: "Lansează prima campanie", body: "Apasă „Creează campanie” pe dashboard. Urmează wizard-ul: obiectiv, buget, audiență, creativ, formular (dacă e cazul) și revizuire. AI-ul îți sugerează audiențe și texte la fiecare pas." },
    ],
  },
  {
    title: "Clipuri și poze generate cu AI",
    items: [
      { id: "primul-clip", h: "Primul clip și 2 poze, gratuite", body: "La înscriere trimiți 2–3 poze cu afacerea ta. AdPilot creează un clip de 20–25 de secunde, cu voce în română, subtitrări și mai multe unghiuri, plus 2 poze pentru reclame. Durează 10–15 minute, iar le primești și pe WhatsApp. Perioada gratuită include doar acest clip și aceste 2 poze." },
      { id: "limite-ai", h: "Câte clipuri și poze primești", body: "Starter: doar cele de la înscriere. Pro și Premium: la fel în primele 7 zile; după abonare, Pro are 4 clipuri și 10 poze AI pe lună, iar Premium 15 clipuri și poze nelimitate. Limitele se reîncarcă la începutul lunii." },
      { id: "folosire-clip", h: "Folosește clipul în reclame", body: "Clipul se publică pe Facebook, Instagram (Reels) și TikTok. Când pornești o reclamă, asistentul te întreabă dacă folosești clipul, pozele sau altceva." },
    ],
  },
  {
    title: "2. Campanii",
    items: [
      { id: "obiective", h: "Obiective acceptate", body: "AdPilot acceptă în prezent Generare clienți potențiali și Trafic pe site. Ambele includ sugestii AI de audiență și optimizare creativă." },
      { id: "buget", h: "Control buget", body: "Alege buget zilnic sau total. Poți modifica bugetul în timp real din ecranul campaniei; modificarea ajunge la platformă în câteva secunde." },
      { id: "monitorizare", h: "Monitorizare performanță", body: "Dashboard-ul actualizează cheltuielile, CTR, costul per client și ROAS la fiecare minut. Deschide o campanie pentru detalii zilnice." },
    ],
  },
  {
    title: "3. Clienți potențiali & CRM",
    items: [
      { id: "inbox", h: "Inbox clienți", body: "Toți clienții colectați din formularele Meta apar în inbox în timp real, cu detalii de contact, câmpurile formularului, campania-sursă și data." },
      { id: "whatsapp", h: "Alerte WhatsApp", body: "Activează alertele WhatsApp din Setări → Notificări. Vei primi un mesaj instant pentru fiecare client nou. Răspunde cu „contactat” sau „exportă clienții de azi”." },
      { id: "crm-export", h: "Export CRM", body: "Conectează CRM-ul tău (HubSpot, Pipedrive, Notion) din Setări → Integrări. Clienții noi se sincronizează automat." },
    ],
  },
  {
    title: "4. Cont & facturare",
    items: [
      { id: "planuri", h: "Planuri și facturare", body: "Administrezi abonamentul din Setări → Facturare. Poți face upgrade sau downgrade oricând. Facturile sunt trimise pe email și salvate în Facturare → Istoric." },
      { id: "echipa", h: "Membri echipă", body: "Planul Pro permite membri nelimitați. Îi inviți pe email din Setări → Echipă. Roluri: Admin, Operator, Vizualizator." },
      { id: "stergere-cont", h: "Ștergere cont", body: "Poți șterge contul oricând din Setări → Cont → Zonă periculoasă. Toate datele personale sunt șterse permanent în 30 de zile." },
    ],
  },
  {
    title: "5. Securitate",
    items: [
      { id: "oauth", h: "OAuth și tokenuri", body: "AdPilot folosește fluxul OAuth 2.0 oficial. Tokenurile sunt criptate în repaus cu AES-256. Nu vedem și nu stocăm parolele tale." },
      { id: "gdpr", h: "GDPR", body: "Toate datele personale sunt procesate în UE. AdPilot este conform GDPR. Vezi pagina GDPR pentru lista completă de drepturi." },
    ],
  },
];

function Documentation() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="Documentație" title="Tot ce ai nevoie ca să livrezi." subtitle="Documentație produs, ghiduri pas-cu-pas și bune practici." />
      <Band tone="light">
        <div className="docs">
          <aside>
            {sections.map((s) => (
              <a key={s.title} href={`#${slug(s.title)}`}>
                {s.title}
              </a>
            ))}
          </aside>
          <div>
            {sections.map((s) => (
              <section key={s.title} id={slug(s.title)}>
                <h2>{s.title}</h2>
                <CardGrid items={s.items.map((it) => ({ title: it.h, body: it.body, id: it.id }))} />
              </section>
            ))}
            <div className="note">
              <h3 className="d3">Nu găsești ce ai nevoie?</h3>
              <p>
                Încearcă <Link to="/help-center">Centrul de ajutor</Link> sau scrie-ne la{" "}
                <a href="mailto:support@adpilot.ro">support@adpilot.ro</a>.
              </p>
            </div>
          </div>
        </div>
      </Band>
    </MarketingLayout>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
