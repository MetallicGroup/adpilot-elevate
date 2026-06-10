import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/integrations")({
  head: () => ({ meta: [
    { title: "Integrations — AdPilot" },
    { name: "description", content: "AdPilot integrates with TikTok Ads, WhatsApp, Stripe, Google Analytics and Meta Pixel." },
  ] }),
  component: IntegrationsPage,
});

const integrations = [
  { name: "TikTok Ads", body: "Official OAuth connection. Create and manage campaigns natively." },
  { name: "WhatsApp", body: "Receive lead notifications and control campaigns via chat." },
  { name: "Stripe", body: "Subscription billing and payment management." },
  { name: "Google Analytics", body: "Cross-channel attribution and conversion tracking." },
  { name: "Meta Pixel", body: "Companion tracking for multi-platform performance comparison." },
];

function IntegrationsPage() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="Integrations" title="Connect the tools you already use." subtitle="AdPilot plugs into your existing stack — no migrations, no replacements." />
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