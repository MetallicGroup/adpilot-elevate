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
    { name: "description", content: "Pachete lunare de clipuri și poze generate cu AI, de la 89 lei. Reclame pe Facebook, Instagram și TikTok de la 495 lei. Anulezi oricând." },
    { property: "og:title", content: "Prețuri — AdPilot" },
    { property: "og:description", content: "Clipuri și poze AI de la 89 lei pe lună. Reclame pe Facebook, Instagram și TikTok de la 495 lei." },
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
  { q: "Pot vedea clipul înainte să plătesc?", a: "Da. Trimiți pozele, AdPilot face clipul din ele și vezi gratuit cum începe, cam primele 8 secunde. Clipul întreg și pozele se deblochează când alegi un pachet." },
  { q: "Clipurile și pozele se consumă separat?", a: "Nu, vin din același total lunar. Un clip consumă cât 10 poze, deci pe Start ai 2 clipuri sau 20 de poze, ori orice combinație între ele. Totalul se reîncarcă la fiecare reînnoire." },
  { q: "Ce pachet are nevoie de reclame?", a: "Reclamele și asistentul de pe WhatsApp sunt incluse de la pachetul Afacere, 495 lei pe lună. Start și Creator sunt doar pentru clipuri și poze." },
  { q: "Cât costă să trec pe un pachet mai mare?", a: "Plătești o singură dată diferența dintre pachete, iar clipurile în plus apar imediat. De exemplu, de la Start la Afacere plătești 406 lei. Reînnoirea rămâne la aceeași dată, la prețul noului pachet." },
  { q: "Pot face reclame și pe TikTok?", a: "Da, de la pachetul Afacere. Conectezi Facebook, TikTok sau ambele, iar AdPilot pornește reclama pe platformele alese. Bugetul îl plătești direct către platformă." },
  { q: "Pot anula oricând?", a: "Da, direct din contul tău, fără întrebări. Abonamentul rămâne activ până la finalul perioadei plătite." },
  { q: "Prețul include bugetul de reclame?", a: "Nu. Abonamentul AdPilot acoperă doar platforma. Bugetul de reclame este plătit direct către Meta (Facebook și Instagram) sau TikTok, din contul tău de reclame." },
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

  const handleSelect = (priceId: string) => {
    tkClickButton(`pricing-select-${priceId}`);
    if (!authed) {
      navigate({ to: "/start", search: { redirect: `/pricing?plan=${priceId}` } as any });
      return;
    }
    openCheckout({ priceId });
  };

  return (
    <MarketingLayout>
      <Hero
        eyebrow="Prețuri"
        title="Vezi gratuit cum începe clipul tău. Plătești doar dacă îl vrei."
        sub="Clipuri și poze generate cu AI de la 89 lei pe lună. Reclamele pe Facebook, Instagram și TikTok sunt incluse de la 495 lei; bugetul îl plătești separat, direct către platformă."
      />
      <Band tone="light">
        <h2 className="sr-only">Planuri și prețuri AdPilot</h2>
        <PlanCards onSelect={(p) => handleSelect(p.id)} />
      </Band>
      <Band tone="light" className="tight">
        <h2 className="d2" data-r>
          Întrebări frecvente
        </h2>
        <Faq items={faqs} />
      </Band>
      <FinalCta title={<>Primul tău clip,<br />în 10 minute.</>} />

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