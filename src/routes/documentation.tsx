import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/documentation")({
  head: () => ({ meta: [
    { title: "Documentație — AdPilot" },
    { name: "description", content: "Documentația produsului: primii pași, creare campanii, integrări și mai mult." },
  ] }),
  component: Documentation,
});

const sections = [
  {
    title: "1. Primii pași",
    items: [
      { id: "creeaza-cont", h: "Creează-ți contul", body: "Înregistrează-te pe adpilot.ro/auth cu email și parolă, sau continuă cu Google. După confirmarea emailului, ajungi direct pe dashboard." },
      { id: "conecteaza", h: "Conectează contul de reclame", body: "Din Setări → Conexiuni, apasă Conectează TikTok sau Meta. Vei fi redirecționat către ecranul OAuth oficial unde alegi ce cont de reclame să partajezi cu AdPilot. Poți revoca accesul oricând." },
      { id: "prima-campanie", h: "Lansează prima campanie", body: "Apasă „Creează campanie” pe dashboard. Urmează wizard-ul: obiectiv, buget, audiență, creativ, formular (dacă e cazul) și revizuire. AI-ul îți sugerează audiențe și texte la fiecare pas." },
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
      { id: "inbox", h: "Inbox clienți", body: "Toți clienții colectați din formularele TikTok și Meta apar în inbox în timp real, cu detalii de contact, câmpurile formularului, campania-sursă și data." },
      { id: "whatsapp", h: "Alerte WhatsApp", body: "Activează alertele WhatsApp din Setări → Notificări. Vei primi un mesaj instant pentru fiecare client nou. Răspunde cu „contactat" sau „exportă clienții de azi"." },
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
      <section className="px-6 pb-24 max-w-5xl mx-auto w-full grid gap-10 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-24 self-start">
          <nav className="space-y-1 text-sm">
            {sections.map((s) => (
              <a key={s.title} href={`#${slug(s.title)}`} className="block py-1.5 text-muted-foreground hover:text-foreground transition-colors">
                {s.title}
              </a>
            ))}
          </nav>
        </aside>
        <div className="space-y-14">
          {sections.map((s) => (
            <section key={s.title} id={slug(s.title)}>
              <h2 className="font-serif text-3xl font-semibold tracking-tight">{s.title}</h2>
              <div className="mt-6 space-y-5">
                {s.items.map((it) => (
                  <div key={it.id} id={it.id} className="card-floating p-6">
                    <h3 className="font-semibold">{it.h}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{it.body}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
          <div className="card-floating-lg p-7">
            <h3 className="font-semibold">Nu găsești ce ai nevoie?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Încearcă <Link to="/help-center" className="underline">Centrul de ajutor</Link> sau scrie-ne la{" "}
              <a href="mailto:support@adpilot.ro" className="underline">support@adpilot.ro</a>.
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
