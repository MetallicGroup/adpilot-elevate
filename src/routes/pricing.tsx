import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [
    { title: "Prețuri — AdPilot" },
    { name: "description", content: "Planuri lunare simple pentru afaceri de orice mărime. 14 zile gratuit. Anulezi oricând." },
    { property: "og:title", content: "Prețuri — AdPilot" },
    { property: "og:description", content: "14 zile gratuit. Fără card. Anulezi oricând." },
    { property: "og:url", content: "https://adpilot.ro/pricing" },
  ], links: [{ rel: "canonical", href: "https://adpilot.ro/pricing" }] }),
  component: PricingPage,
});

const plans = [
  { name: "Starter", price: "€99", desc: "For small businesses launching their first TikTok ads.", items: ["1 ad account", "Up to €2,000/mo ad spend", "AI campaign builder", "Email support"] },
  { name: "Growth", price: "€199", featured: true, desc: "For growing brands scaling lead generation.", items: ["3 ad accounts", "Up to €10,000/mo ad spend", "WhatsApp AI assistant", "Priority support"] },
  { name: "Pro", price: "€399", desc: "For agencies and high-spend advertisers.", items: ["Unlimited ad accounts", "Unlimited ad spend", "Dedicated success manager", "Custom integrations & SLA"] },
];

const faqs = [
  { q: "Is there a free trial?", a: "Yes. Every plan includes a 14-day free trial. No credit card required." },
  { q: "Can I cancel anytime?", a: "Yes. Subscriptions can be canceled at any time directly from your dashboard." },
  { q: "Does the price include TikTok ad spend?", a: "No. AdPilot's subscription is for the platform only. TikTok ad spend is billed separately by TikTok." },
];

function PricingPage() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="Pricing" title="Simple plans that scale with you." subtitle="14-day free trial on every plan. No credit card required." />
      <section className="px-6 pb-20 max-w-6xl mx-auto w-full grid gap-5 md:grid-cols-3">
        {plans.map((p) => (
          <div key={p.name} className={`card-floating p-8 ${p.featured ? "ring-2 ring-foreground" : ""}`}>
            {p.featured && <p className="text-xs font-medium text-tiktok mb-2">Most popular</p>}
            <h3 className="font-semibold text-xl">{p.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
            <p className="mt-6 font-serif text-5xl">{p.price}<span className="text-base text-muted-foreground font-sans">/mo</span></p>
            <ul className="mt-6 space-y-2">
              {p.items.map((it) => (
                <li key={it} className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-success" />{it}</li>
              ))}
            </ul>
            <Link to="/auth" className="press mt-8 inline-flex w-full items-center justify-center px-4 py-3 rounded-lg bg-foreground text-background font-medium">Start Free Trial</Link>
          </div>
        ))}
      </section>
      <section className="px-6 pb-24 max-w-3xl mx-auto w-full">
        <h2 className="font-serif text-3xl font-semibold mb-6">Pricing FAQ</h2>
        <div className="space-y-3">
          {faqs.map((f) => (
            <div key={f.q} className="card-floating p-6">
              <h3 className="font-semibold">{f.q}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}