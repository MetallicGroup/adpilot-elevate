import { useEffect } from "react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Band, ChatPhone, Faq, FinalCta, Hero, PlanCards, SignupButton } from "@/components/v2/kit";
import { tkViewContent, tkClickButton } from "@/lib/tiktok-pixel";
import { fbViewContent } from "@/lib/meta-pixel";
import type { NicheConfig } from "@/lib/niches";

/** Landing page for one business niche (/beauty, /dentist, ...), driven by niches.ts. */
export function NicheLanding({ niche }: { niche: NicheConfig }) {
  useEffect(() => {
    tkViewContent({ contentId: niche.contentId, contentName: niche.slug });
    fbViewContent(niche.slug);
  }, [niche.contentId, niche.slug]);

  const cta = niche.hero.ctaLabel;
  const track = (where: string) => () => tkClickButton(`niche-${niche.slug}-${where}`);

  return (
    <MarketingLayout>
      <Hero
        eyebrow={niche.hero.badge}
        title={
          <>
            {niche.hero.titlePre}
            <span className="gtext">{niche.hero.titleHighlight}</span>
            {niche.hero.titlePost}
          </>
        }
        sub={niche.hero.subtitle}
        aside={<ChatPhone lines={niche.demo.lines} />}
      >
        <div className="cta">
          <SignupButton label={cta} onClick={track("hero")} />
        </div>
        <div className="facts">
          <span>7 zile gratuite</span>
          <span>Fără card</span>
          <span>Fără agenție</span>
        </div>
      </Hero>

      <Band tone="light">
        <p className="ey" data-r>
          Sună cunoscut?
        </p>
        <h2 className="d2" data-r style={{ marginTop: 16, maxWidth: "16ch" }}>
          {niche.problem.title}
        </h2>
        <div className="rows">
          {niche.problem.items.map((it, i) => (
            <div key={it} data-r>
              <span className="k">0{i + 1}</span>
              <p>{it}</p>
            </div>
          ))}
        </div>
      </Band>

      <Band tone="dark">
        <p className="ey" data-r>
          Cum funcționează
        </p>
        <h2 className="d2" data-r style={{ marginTop: 16, maxWidth: "18ch" }}>
          {niche.demo.title}
        </h2>
        <div className="trio">
          {niche.steps.map((s, i) => (
            <div key={s.title} data-r style={{ ["--d" as string]: `${i * 0.08}s` }}>
              <span className="k">PASUL {i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="cta" style={{ marginTop: 36 }} data-r>
          <SignupButton label={cta} onClick={track("pasi")} />
        </div>
      </Band>

      <Band tone="light">
        <p className="ey" data-r>
          Prețuri
        </p>
        <h2 className="d2" data-r style={{ marginTop: 16, maxWidth: "15ch" }}>
          Primele 7 zile sunt gratuite. Fără card.
        </h2>
        <PlanCards />
      </Band>

      <Band tone="light" className="tight">
        <h2 className="d2" data-r>
          Întrebări
        </h2>
        <Faq items={niche.faq} />
      </Band>

      <FinalCta title={niche.socialProof.replace(/\s*🇷🇴/, "")} label="Începe gratuit acum" onClick={track("final")} />
    </MarketingLayout>
  );
}
