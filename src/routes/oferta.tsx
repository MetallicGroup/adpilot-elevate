import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Band, ChatPhone, FinalCta, Hero, PlanCards, SignupButton, type ChatLine } from "@/components/v2/kit";
import { tkViewContent, tkClickButton } from "@/lib/tiktok-pixel";
import { fbViewContent } from "@/lib/meta-pixel";

export const Route = createFileRoute("/oferta")({
  head: () => ({
    meta: [
      { title: "Începe GRATUIT — AdPilot" },
      {
        name: "description",
        content:
          "Spune-i ce vrei să obții. AdPilot creează, lansează și optimizează reclamele tale pe Facebook și Instagram — fără agenție și fără experiență. 7 zile gratuite pentru orice cont nou, fără card.",
      },
      { property: "og:title", content: "Începe GRATUIT — AdPilot" },
      {
        property: "og:description",
        content:
          "AdPilot se ocupă de reclame: mai multe vânzări, programări sau clienți. Fără agenție, fără experiență.",
      },
      { property: "og:url", content: "https://adpilot.ro/oferta" },
    ],
    links: [{ rel: "canonical", href: "https://adpilot.ro/oferta" }],
  }),
  component: OfertaPage,
});

/** CTA reutilizabil „Înregistrează-te acum". */
const DEMO: ChatLine[] = [
  { from: "me", text: "Vreau mai mulți clienți pentru afacerea mea" },
  { from: "bot", text: "Sigur. În ce oraș și ce buget pe zi?" },
  { from: "me", text: "București, 50 lei pe zi" },
  { from: "bot", text: "✅ Reclama e live pe Facebook și Instagram." },
  { from: "bot", text: "🔔 Client nou: Andreea M. — „Aș vrea detalii.”" },
];

const WHAT = [
  { t: "Îi spui obiectivul", d: "„Vreau mai multe vânzări” sau „mai multe programări”. Atât. În română, pe înțelesul tău." },
  { t: "AdPilot lansează", d: "Creează reclama, textele și targetarea, apoi o pune live pe Facebook și Instagram." },
  { t: "Optimizează singur", d: "Urmărește rezultatele zi de zi și ajustează campania ca să aduci clienți mai ieftin." },
];

const STEPS = [
  { t: "Conectează Facebook", d: "Legi pagina și contul de reclame în câteva secunde." },
  { t: "Alegi obiectivul", d: "Vânzări, programări, clienți sau apeluri. Tu decizi." },
  { t: "Pornești din WhatsApp", d: "Asistentul AdPilot lansează și îți raportează totul pe WhatsApp." },
];

const WHY = [
  "Fără comisioane de agenție și fără contracte lunare mari.",
  "Fără să înveți Facebook Ads Manager. Vorbești normal, în română.",
  "Reclame live în minute, nu în săptămâni de emailuri.",
  "Rezultatele și banii cheltuiți, transparent, direct pe WhatsApp.",
];

function OfertaPage() {
  useEffect(() => {
    tkViewContent({ contentId: "oferta", contentName: "Oferta" });
    fbViewContent("oferta");
  }, []);
  const track = (where: string) => () => tkClickButton(`oferta-${where}`);

  return (
    <MarketingLayout>
      <Hero
        eyebrow="7 zile gratuite · fără card"
        title={
          <>
            Începe <span className="gtext">gratuit.</span>
          </>
        }
        sub="Spune-i ce vrei să obții. AdPilot creează, lansează și optimizează reclamele tale pe Facebook și Instagram, fără agenție și fără experiență."
        aside={<ChatPhone lines={DEMO} />}
      >
        <div className="cta">
          <SignupButton label="Începe gratuit acum" onClick={track("hero")} />
        </div>
        <div className="facts">
          <span>Asistent pe WhatsApp inclus</span>
          <span>Fără card</span>
          <span>Fără agenție</span>
        </div>
      </Hero>

      <Band tone="light">
        <p className="ey" data-r>
          Ce e AdPilot
        </p>
        <h2 className="d2" data-r style={{ marginTop: 16, maxWidth: "16ch" }}>
          Reclame profesioniste, fără să fii expert.
        </h2>
        <div className="trio">
          {WHAT.map((c, i) => (
            <div key={c.t} data-r style={{ ["--d" as string]: `${i * 0.08}s` }}>
              <h3 style={{ marginTop: 0 }}>{c.t}</h3>
              <p>{c.d}</p>
            </div>
          ))}
        </div>
        <div className="cta" style={{ marginTop: 36 }} data-r>
          <SignupButton tone="k" label="Înregistrează-te acum" onClick={track("ce-e")} />
        </div>
      </Band>

      <Band tone="dark">
        <p className="ey" data-r>
          Cum funcționează
        </p>
        <h2 className="d2" data-r style={{ marginTop: 16 }}>
          Trei pași și ești live.
        </h2>
        <div className="trio">
          {STEPS.map((c, i) => (
            <div key={c.t} data-r style={{ ["--d" as string]: `${i * 0.08}s` }}>
              <span className="k">PASUL {i + 1}</span>
              <h3>{c.t}</h3>
              <p>{c.d}</p>
            </div>
          ))}
        </div>
      </Band>

      <Band tone="light">
        <p className="ey" data-r>
          De ce AdPilot
        </p>
        <h2 className="d2" data-r style={{ marginTop: 16, maxWidth: "16ch" }}>
          Cât o agenție. Fără costul unei agenții.
        </h2>
        <div className="rows">
          {WHY.map((t, i) => (
            <div key={t} data-r>
              <span className="k">0{i + 1}</span>
              <p>{t}</p>
            </div>
          ))}
        </div>
      </Band>

      <Band tone="light" className="tight">
        <p className="ey" data-r>
          Prețuri
        </p>
        <h2 className="d2" data-r style={{ marginTop: 16, maxWidth: "15ch" }}>
          Primele 7 zile sunt gratuite. Fără card.
        </h2>
        <PlanCards />
      </Band>

      <FinalCta title={<>Prima reclamă,<br />în 5 minute.</>} label="Începe gratuit acum" onClick={track("final")} />
    </MarketingLayout>
  );
}
