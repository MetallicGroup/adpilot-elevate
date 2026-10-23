import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { Band, CardGrid } from "@/components/v2/kit";

export const Route = createFileRoute("/integrations")({
  head: () => ({ meta: [
    { title: "Integrări — AdPilot" },
    { name: "description", content: "AdPilot se integrează cu Meta Ads (Facebook și Instagram), TikTok Ads, WhatsApp, Stripe, Google Analytics și pixelii Meta și TikTok." },
    { property: "og:title", content: "Integrări — AdPilot" },
    { property: "og:description", content: "AdPilot se integrează cu Meta Ads (Facebook și Instagram), TikTok Ads, WhatsApp, Stripe, Google Analytics și pixelii Meta și TikTok." },
    { property: "og:url", content: "https://adpilot.ro/integrations" },
  ], links: [{ rel: "canonical", href: "https://adpilot.ro/integrations" }] }),
  component: IntegrationsPage,
});

const integrations = [
  { name: "Meta Ads (Facebook și Instagram)", body: "Lansezi și administrezi campanii direct pe Facebook și Instagram." },
  { name: "TikTok Ads", body: "Pornești reclame video pe TikTok din aceeași conversație, cu același clip făcut de AI." },
  { name: "Studio AI", body: "Poze și clipuri de 20–25 de secunde, cu voce în română și subtitrări, generate din pozele tale." },
  { name: "WhatsApp", body: "Primești notificări pentru fiecare client nou și controlezi campaniile direct din chat." },
  { name: "Stripe", body: "Abonamente și plăți gestionate automat." },
  { name: "Google Analytics", body: "Atribuire multi-canal și urmărirea conversiilor." },
  { name: "Meta Pixel și TikTok Pixel", body: "Tracking complementar pentru compararea performanței între platforme." },
];

function IntegrationsPage() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="Integrări" title="Conectează instrumentele pe care le folosești deja." subtitle="AdPilot se integrează în stack-ul tău — fără migrări, fără înlocuiri." />
      <Band tone="light">
        <h2 className="sr-only">Integrări disponibile</h2>
        <CardGrid items={integrations.map((i) => ({ title: i.name, body: i.body }))} />
      </Band>
    </MarketingLayout>
  );
}
