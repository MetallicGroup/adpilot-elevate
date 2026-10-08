import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { Band, CardGrid, FinalCta } from "@/components/v2/kit";
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
      <Band tone="light">
        <h2 className="sr-only">Funcționalitățile platformei AdPilot</h2>
        <CardGrid items={features.map((f) => ({ title: f.title, list: f.items }))} />
      </Band>
      <FinalCta title={<>Prima reclamă,<br />în 5 minute.</>} />
    </MarketingLayout>
  );
}
