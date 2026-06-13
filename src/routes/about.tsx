import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [
    { title: "Despre — AdPilot" },
    { name: "description", content: "AdPilot face publicitatea TikTok accesibilă oricărei afaceri — fără agenție." },
    { property: "og:title", content: "Despre AdPilot" },
    { property: "og:description", content: "Misiunea noastră: reclame TikTok accesibile oricărei afaceri." },
    { property: "og:url", content: "https://adpilot.ro/about" },
  ], links: [{ rel: "canonical", href: "https://adpilot.ro/about" }] }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="About" title="Making TikTok ads accessible to every business." subtitle="We started AdPilot because we believe small businesses deserve the same advertising firepower as global brands — without the agency fees." />
      <section className="px-6 pb-20 max-w-3xl mx-auto w-full space-y-8 text-muted-foreground leading-relaxed">
        <p>AdPilot was founded in 2025 by a team of marketers, engineers and AI researchers who spent years building performance campaigns for direct-to-consumer brands. We saw the same story repeat over and over: a great product, a tight budget, and a complex ad platform that required a full-time specialist just to launch a single campaign.</p>
        <p>TikTok is the most powerful customer acquisition channel of the decade — and it deserves a tool that meets businesses where they are. AdPilot replaces the agency with an AI co-pilot that builds, launches and optimizes TikTok campaigns in minutes, not weeks.</p>
        <p>Today, AdPilot serves service businesses, eCommerce brands and local operators across Europe. We are headquartered in Bucharest, Romania, with a fully remote team across the EU.</p>
        <div className="grid sm:grid-cols-3 gap-4 not-prose pt-4">
          <Stat label="Founded" value="2025" />
          <Stat label="HQ" value="Bucharest, RO" />
          <Stat label="Team" value="Fully remote" />
        </div>
      </section>
    </MarketingLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-floating p-5 text-center">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-2xl text-foreground">{value}</p>
    </div>
  );
}