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
  {
    name: "Starter",
    price: "249 lei",
    desc: "Pentru afaceri mici care încep cu reclamele online.",
    items: [
      "3 campanii pe lună",
      "Fără generare AI de poze sau clipuri",
      "Asistent WhatsApp AI",
      "Suport pe email",
    ],
  },
  {
    name: "Pro",
    price: "495 lei",
    featured: true,
    desc: "Pentru afacerile care vor să crească rapid.",
    items: [
      "Campanii nelimitate",
      "10 clipuri AI pe lună",
      "20 de poze AI pe lună",
      "Asistent WhatsApp AI",
      "Suport prioritar",
    ],
  },
  {
    name: "Premium",
    price: "995 lei",
    desc: "Pentru branduri și agenții care scalează agresiv.",
    items: [
      "Campanii nelimitate",
      "Clipuri AI nelimitate",
      "Poze AI nelimitate",
      "Asistent WhatsApp AI",
      "Success manager dedicat",
    ],
  },
];

const faqs = [
  { q: "Există perioadă de probă gratuită?", a: "Da. Fiecare plan include 14 zile gratuit. Fără card." },
  { q: "Pot anula oricând?", a: "Da. Anulezi oricând direct din contul tău, fără întrebări." },
  { q: "Prețul include bugetul de reclame?", a: "Nu. Abonamentul AdPilot acoperă doar platforma. Bugetul de reclame este plătit direct către Meta/TikTok, din contul tău." },
];

function PricingPage() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="Prețuri" title="Planuri simple care cresc o dată cu tine." subtitle="14 zile gratuit pe orice plan. Fără card." />
      <section className="px-6 pb-20 max-w-6xl mx-auto w-full grid gap-5 md:grid-cols-3">
        {plans.map((p) => (
          <div key={p.name} className={`card-floating p-8 ${p.featured ? "ring-2 ring-foreground" : ""}`}>
            {p.featured && <p className="text-xs font-medium text-tiktok mb-2">Cel mai popular</p>}
            <h3 className="font-semibold text-xl">{p.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
            <p className="mt-6 font-serif text-5xl">{p.price}<span className="text-base text-muted-foreground font-sans">/lună</span></p>
            <ul className="mt-6 space-y-2">
              {p.items.map((it) => (
                <li key={it} className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-success" />{it}</li>
              ))}
            </ul>
            <Link to="/auth" className="press mt-8 inline-flex w-full items-center justify-center px-4 py-3 rounded-lg bg-foreground text-background font-medium">Începe gratuit</Link>
          </div>
        ))}
      </section>
      <section className="px-6 pb-24 max-w-3xl mx-auto w-full">
        <h2 className="font-serif text-3xl font-semibold mb-6">Întrebări frecvente</h2>
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