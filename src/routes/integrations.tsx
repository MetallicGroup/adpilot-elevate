import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/integrations")({
  head: () => ({ meta: [
    { title: "Integrări — AdPilot" },
    { name: "description", content: "AdPilot se integrează cu TikTok Ads, Meta Ads, WhatsApp, Stripe, Google Analytics și Meta Pixel." },
  ] }),
  component: IntegrationsPage,
});

const integrations = [
  { name: "TikTok Ads", body: "Conexiune OAuth oficială. Creezi și administrezi campanii nativ." },
  { name: "Meta Ads (Facebook & Instagram)", body: "Lansezi și administrezi campanii direct pe Facebook și Instagram." },
  { name: "WhatsApp", body: "Primești notificări pentru fiecare client nou și controlezi campaniile direct din chat." },
  { name: "Stripe", body: "Abonamente și plăți gestionate automat." },
  { name: "Google Analytics", body: "Atribuire multi-canal și urmărirea conversiilor." },
  { name: "Meta Pixel", body: "Tracking complementar pentru compararea performanței între platforme." },
];

function IntegrationsPage() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="Integrări" title="Conectează instrumentele pe care le folosești deja." subtitle="AdPilot se integrează în stack-ul tău — fără migrări, fără înlocuiri." />
      <section className="px-6 pb-20 max-w-5xl mx-auto w-full grid gap-5 md:grid-cols-2">
        {integrations.map((i) => (
          <div key={i.name} className="card-floating p-7">
            <h3 className="font-semibold text-lg">{i.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{i.body}</p>
          </div>
        ))}
      </section>
    </MarketingLayout>
  );
}