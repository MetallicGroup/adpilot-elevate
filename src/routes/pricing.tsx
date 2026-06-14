import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { Check, X } from "lucide-react";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [
    { title: "Prețuri — AdPilot" },
    { name: "description", content: "Planuri lunare simple pentru afaceri de orice mărime. 7 zile gratuit. Anulezi oricând." },
    { property: "og:title", content: "Prețuri — AdPilot" },
    { property: "og:description", content: "7 zile gratuit. Anulezi oricând." },
    { property: "og:url", content: "https://adpilot.ro/pricing" },
  ], links: [{ rel: "canonical", href: "https://adpilot.ro/pricing" }] }),
  component: PricingPage,
});

const plans = [
  {
    name: "Starter",
    priceId: "starter_monthly",
    price: "249 lei",
    desc: "Pentru afaceri mici care încep cu reclamele online.",
    items: [
      "3 campanii pe lună",
      "Asistent WhatsApp AI",
      "Suport pe email",
    ],
    notIncluded: ["Generare AI de poze sau clipuri"],
  },
  {
    name: "Pro",
    priceId: "pro_monthly",
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
    notIncluded: [],
  },
  {
    name: "Premium",
    priceId: "premium_monthly",
    price: "995 lei",
    desc: "Pentru branduri și agenții care scalează agresiv.",
    items: [
      "Campanii nelimitate",
      "Clipuri AI nelimitate",
      "Poze AI nelimitate",
      "Asistent WhatsApp AI",
      "Success manager dedicat",
    ],
    notIncluded: [],
  },
];

const faqs = [
  { q: "Există perioadă de probă gratuită?", a: "Da. Fiecare plan include 7 zile gratuit. Îți cerem cardul la activare pentru a evita întreruperea după probă, dar nu îți retragem nimic înainte de a 8-a zi." },
  { q: "Pot anula oricând?", a: "Da. Poți anula oricând în timpul perioadei de probă fără să fii taxat, sau ulterior direct din contul tău, fără întrebări." },
  { q: "Prețul include bugetul de reclame?", a: "Nu. Abonamentul AdPilot acoperă doar platforma. Bugetul de reclame este plătit direct către Meta (Facebook & Instagram), din contul tău." },
  { q: "Ce metode de plată acceptați?", a: "Toate cardurile majore: Visa, Mastercard, Maestro. Plățile sunt procesate securizat prin Stripe." },
];

function PricingPage() {
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  const handleSelect = (priceId: string) => {
    if (!authed) {
      navigate({ to: "/auth", search: { redirect: `/pricing?plan=${priceId}` } as any });
      return;
    }
    openCheckout({ priceId });
  };

  return (
    <MarketingLayout>
      <PageHero
        eyebrow="Prețuri"
        title="Planuri simple care cresc o dată cu tine."
        subtitle="7 zile gratuit pe orice plan. Nu îți retragem nimic înainte de a 8-a zi."
      />
      <section className="px-6 pb-20 max-w-6xl mx-auto w-full grid gap-5 md:grid-cols-3">
        {plans.map((p) => (
          <div key={p.name} className={`card-floating p-8 ${p.featured ? "ring-2 ring-primary relative" : ""}`}>
            {p.featured && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-primary text-primary-foreground">
                Cel mai popular
              </span>
            )}
            <h3 className="font-semibold text-xl">{p.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
            <p className="mt-6 font-serif text-5xl">{p.price}<span className="text-base text-muted-foreground font-sans">/lună</span></p>
            <p className="mt-2 text-xs text-success font-medium">✨ 7 zile gratuit</p>
            <ul className="mt-6 space-y-2">
              {p.items.map((it) => (
                <li key={it} className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-success" />{it}</li>
              ))}
              {p.notIncluded?.map((it) => (
                <li key={it} className="flex items-center gap-2 text-sm text-muted-foreground/70 line-through"><X className="w-4 h-4" />{it}</li>
              ))}
            </ul>
            <button
              onClick={() => handleSelect(p.priceId)}
              className={`press mt-8 inline-flex w-full items-center justify-center px-4 py-3 rounded-lg font-medium ${
                p.featured ? "bg-primary text-primary-foreground" : "bg-foreground text-background"
              }`}
            >
              Începe cele 7 zile gratuit
            </button>
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

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 md:p-8">
            <button
              onClick={closeCheckout}
              className="mb-4 text-sm text-muted-foreground hover:text-foreground"
            >
              ← Înapoi la planuri
            </button>
            {checkoutElement}
          </div>
        </div>
      )}
    </MarketingLayout>
  );
}