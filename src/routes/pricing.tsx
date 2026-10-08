import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Band, Faq, FinalCta, Hero, PlanCards } from "@/components/v2/kit";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { tkViewContent, tkClickButton } from "@/lib/tiktok-pixel";

export const Route = createFileRoute("/pricing")({
  validateSearch: (s: Record<string, unknown>): { plan?: string; redirect?: string } => ({
    plan: typeof s.plan === "string" ? s.plan : undefined,
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({ meta: [
    { title: "Prețuri — AdPilot" },
    { name: "description", content: "Planuri lunare simple pentru afaceri de orice mărime. 7 zile gratuite, fără card. Anulezi oricând." },
    { property: "og:title", content: "Prețuri — AdPilot" },
    { property: "og:description", content: "7 zile gratuite, fără card. Anulezi oricând." },
    { property: "og:url", content: "https://adpilot.ro/pricing" },
  ], links: [{ rel: "canonical", href: "https://adpilot.ro/pricing" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: PricingPage,
});

const faqs = [
  { q: "Există perioadă de probă gratuită?", a: "Da — 7 zile gratuite pentru orice cont nou, fără card, de la crearea contului. Planul Starter rămâne gratuit apoi 7 zile în fiecare lună. Pentru Pro/Premium primești pe WhatsApp un link de plată când vrei să continui nelimitat." },
  { q: "Pot anula oricând?", a: "Da. Poți anula oricând în timpul perioadei de probă fără să fii taxat, sau ulterior direct din contul tău, fără întrebări." },
  { q: "Prețul include bugetul de reclame?", a: "Nu. Abonamentul AdPilot acoperă doar platforma. Bugetul de reclame este plătit direct către Meta (Facebook & Instagram), din contul tău." },
  { q: "Ce metode de plată acceptați?", a: "Toate cardurile majore: Visa, Mastercard, Maestro. Plățile sunt procesate securizat prin Stripe." },
];

function PricingPage() {
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    tkViewContent({ contentId: "pricing", contentName: "Pricing" });
  }, []);

  useEffect(() => {
    let opened = false;
    supabase.auth.getUser().then(({ data }) => {
      const isAuthed = !!data.user;
      setAuthed(isAuthed);
      // Utilizator revenit din /auth cu planul ales -> deschide direct checkout-ul.
      const plan = search.plan;
      if (isAuthed && plan && !opened) {
        opened = true;
        openCheckout({ priceId: plan });
        navigate({ to: "/pricing", search: {}, replace: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (priceId: string, free?: boolean) => {
    tkClickButton(`pricing-select-${priceId}`);
    if (free) {
      // Starter gratuit: fără Stripe. Neautentificat → cont; autentificat → onboarding
      // (unde conectează Facebook + număr și pornește gratuitul).
      navigate(
        authed
          ? ({ to: "/onboarding" } as any)
          : ({ to: "/auth", search: { mode: "signup" } } as any),
      );
      return;
    }
    if (!authed) {
      navigate({ to: "/auth", search: { redirect: `/pricing?plan=${priceId}` } as any });
      return;
    }
    openCheckout({ priceId });
  };

  return (
    <MarketingLayout>
      <Hero
        eyebrow="Prețuri"
        title="Primele 7 zile sunt gratuite. Fără card."
        sub="Alegi planul la înscriere și îl folosești complet 7 zile. Starter rămâne gratuit 7 zile pe lună; Pro și Premium continuă nelimitat după ce plătești. Bugetul de reclame îl plătești separat, direct către Meta."
      />
      <Band tone="light">
        <h2 className="sr-only">Planuri și prețuri AdPilot</h2>
        <PlanCards onSelect={(p) => handleSelect(p.id, p.free)} />
      </Band>
      <Band tone="light" className="tight">
        <h2 className="d2" data-r>
          Întrebări frecvente
        </h2>
        <Faq items={faqs} />
      </Band>
      <FinalCta title={<>Prima reclamă,<br />în 5 minute.</>} />

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