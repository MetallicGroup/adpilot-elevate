import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { Band, CardGrid, FinalCta } from "@/components/v2/kit";
import { Check, Megaphone, Bot, Inbox, LineChart, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({ meta: [
    { title: "Funcționalități — AdPilot" },
    { name: "description", content: "Reclame pe Facebook, Instagram și TikTok, poze și clipuri generate cu AI, lead-uri direct pe WhatsApp, analiză și asistent AI — totul într-o singură platformă." },
    { property: "og:title", content: "Funcționalități — AdPilot" },
    { property: "og:description", content: "Reclame Facebook, Instagram și TikTok, poze și clipuri AI, lead-uri și asistent WhatsApp — totul într-un loc." },
    { property: "og:url", content: "https://adpilot.ro/features" },
  ], links: [{ rel: "canonical", href: "https://adpilot.ro/features" }] }),
  component: FeaturesPage,
});

const features = [
  { icon: Megaphone, title: "Reclame pe Facebook, Instagram și TikTok", items: ["Creare campanii cap-coadă, pe una sau pe toate platformele", "Reclame video pe TikTok și Reels", "Buget zilnic mutat spre reclamele care merg", "Monitorizare în timp real"] },
  { icon: Sparkles, title: "Poze și clipuri generate cu AI", items: ["Clip de 20–25 de secunde din pozele tale", "Voce în română, cu buzele sincronizate", "Subtitrări pe cuvânt, mai multe unghiuri", "Poze pentru reclame, în câteva minute"] },
  { icon: Bot, title: "AI Campaign Builder", items: ["Sugestii AI de audiență", "Generare text de reclamă cu AI", "Structură automată de campanie", "Sfaturi inteligente de optimizare"] },
  { icon: Inbox, title: "Generare clienți potențiali", items: ["Formulare native Facebook, Instagram și TikTok", "Notificări instant", "Pregătit pentru CRM", "Alerte pe WhatsApp"] },
  { icon: LineChart, title: "Analitică", items: ["Cheltuieli & rată click", "Cost per client & ROAS", "Tracking conversii", "Rapoarte zilnice"] },
  { icon: MessageCircle, title: "Asistent WhatsApp AI", items: ['„Pornește campania"', '„Mărește bugetul cu 20%"', '„Câți clienți noi azi?"', "Control 24/7 prin chat"] },
  { icon: ShieldCheck, title: "Securitate", items: ["OAuth oficial", "Conform GDPR", "Stocare criptată", "Tu deții contul de reclame"] },
];

function FeaturesPage() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="Funcționalități" title="Tot ce ai nevoie pentru reclame care vând." subtitle="De la poza și clipul făcute cu AI până la livrarea clienților, AdPilot acoperă tot ciclul unei campanii pe Facebook, Instagram sau TikTok." />
      <Band tone="light">
        <h2 className="sr-only">Funcționalitățile platformei AdPilot</h2>
        <CardGrid items={features.map((f) => ({ title: f.title, list: f.items }))} />
      </Band>
      <FinalCta title={<>Prima reclamă,<br />în 5 minute.</>} />
    </MarketingLayout>
  );
}
