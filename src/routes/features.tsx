import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { Check, Megaphone, Bot, Inbox, LineChart, MessageCircle, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({ meta: [
    { title: "Funcționalități — AdPilot" },
    { name: "description", content: "Management reclame Facebook & Instagram, creare campanii cu AI, generare lead-uri, analiză și asistent WhatsApp AI — totul într-o singură platformă." },
    { property: "og:title", content: "Funcționalități — AdPilot" },
    { property: "og:description", content: "Management reclame Facebook & Instagram, AI builder, lead-uri, analiză și asistent WhatsApp — totul într-un loc." },
    { property: "og:url", content: "https://adpilot.ro/features" },
  ], links: [{ rel: "canonical", href: "https://adpilot.ro/features" }] }),
  component: FeaturesPage,
});

const features = [
  { icon: Megaphone, title: "Management reclame Facebook & Instagram", items: ["Creare campanii cap-coadă", "Administrare în masă", "Buget zilnic sau total", "Monitorizare în timp real"] },
  { icon: Bot, title: "AI Campaign Builder", items: ["Sugestii AI de audiență", "Generare text de reclamă cu AI", "Structură automată de campanie", "Sfaturi inteligente de optimizare"] },
  { icon: Inbox, title: "Generare clienți potențiali", items: ["Formulare native Facebook & Instagram", "Notificări instant", "Pregătit pentru CRM", "Alerte pe WhatsApp"] },
  { icon: LineChart, title: "Analitică", items: ["Cheltuieli & rată click", "Cost per client & ROAS", "Tracking conversii", "Rapoarte zilnice"] },
  { icon: MessageCircle, title: "Asistent WhatsApp AI", items: ['„Pornește campania"', '„Mărește bugetul cu 20%"', '„Câți clienți noi azi?"', "Control 24/7 prin chat"] },
  { icon: ShieldCheck, title: "Securitate", items: ["OAuth oficial", "Conform GDPR", "Stocare criptată", "Tu deții contul de reclame"] },
];

function FeaturesPage() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="Funcționalități" title="Tot ce ai nevoie pentru reclame care vând." subtitle="De la creare până la livrarea clienților, AdPilot acoperă tot ciclul unei campanii Facebook sau Instagram." />
      <section className="px-6 pb-20 max-w-6xl mx-auto w-full grid gap-5 md:grid-cols-2">
        {features.map((f) => (
          <div key={f.title} className="card-floating p-7">
            <f.icon className="w-5 h-5 text-primary" />
            <h3 className="mt-4 font-semibold text-lg">{f.title}</h3>
            <ul className="mt-4 space-y-2">
              {f.items.map((i) => (
                <li key={i} className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-success mt-0.5 shrink-0" />{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <section className="px-6 py-16 max-w-3xl mx-auto w-full text-center">
        <Link to="/auth" className="press inline-flex items-center px-8 py-4 bg-foreground text-background rounded-xl font-medium">Începe gratuit</Link>
      </section>
    </MarketingLayout>
  );
}