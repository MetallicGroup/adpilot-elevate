import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Facebook, Instagram, MessageCircle, Check, ArrowRight } from "lucide-react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Reveal } from "@/components/wow/Reveal";
import {
  firstMonthPrice,
  FIRST_MONTH_BADGE,
  FREE_STARTER_LABEL,
  FREE_STARTER_SUBLABEL,
} from "@/lib/promo";
import { tkViewContent, tkClickButton } from "@/lib/tiktok-pixel";
import { fbViewContent } from "@/lib/meta-pixel";
import type { NicheConfig } from "@/lib/niches";

function SignupCTA({
  id,
  label,
  className = "",
}: {
  id: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      to="/auth"
      search={{ mode: "signup" } as never}
      onClick={() => tkClickButton(`niche-${id}`)}
      className={`press btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-base font-semibold ${className}`}
    >
      {label} <ArrowRight className="w-5 h-5" />
    </Link>
  );
}

const PLANS = [
  { name: "Starter", free: true, price: "Gratuit", items: ["Asistent WhatsApp AI inclus", "Campanii pe Facebook & Instagram", "3 zile gratuit în fiecare lună"] },
  { name: "Pro", price: "495 lei", featured: true, items: ["Campanii nelimitate, non-stop", "10 poze AI / lună", "Asistent WhatsApp AI", "Suport prioritar"] },
  { name: "Premium", price: "995 lei", items: ["Campanii nelimitate, non-stop", "Poze AI nelimitate", "Asistent WhatsApp AI", "Manager dedicat"] },
];

export function NicheLanding({ niche }: { niche: NicheConfig }) {
  useEffect(() => {
    tkViewContent({ contentId: niche.contentId, contentName: niche.slug });
    fbViewContent(niche.slug);
  }, [niche.contentId, niche.slug]);

  const cta = niche.hero.ctaLabel;

  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="px-6 pt-20 pb-12 max-w-4xl mx-auto w-full text-center">
        <Reveal>
          <span className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-1.5 rounded-full bg-primary/10 text-primary">
            {niche.hero.badge}
          </span>
        </Reveal>
        <Reveal delay={1}>
          <h1 className="mt-6 font-serif text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-balance">
            {niche.hero.titlePre}
            <span className="gradient-text">{niche.hero.titleHighlight}</span>
            {niche.hero.titlePost}
          </h1>
        </Reveal>
        <Reveal delay={2}>
          <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">{niche.hero.subtitle}</p>
        </Reveal>
        <Reveal delay={3}>
          <div className="mt-8">
            <SignupCTA id={`${niche.slug}-hero`} label={cta} className="text-lg px-8 py-4" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            ✅ {FREE_STARTER_LABEL} · fără card · 🎉 -50% prima lună pe Pro & Premium
          </p>
          <p className="mt-6 text-sm text-muted-foreground">{niche.socialProof}</p>
        </Reveal>
      </section>

      {/* PROBLEMA */}
      <section className="px-6 py-14 max-w-3xl mx-auto w-full">
        <Reveal>
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-center">
            {niche.problem.title}
          </h2>
        </Reveal>
        <div className="mt-8 space-y-3">
          {niche.problem.items.map((it, i) => (
            <Reveal key={it} delay={i} className="flex items-start gap-3 card-floating p-5">
              <span className="text-xl leading-none">😕</span>
              <p className="text-sm">{it}</p>
            </Reveal>
          ))}
        </div>
        <div className="mt-8 text-center">
          <SignupCTA id={`${niche.slug}-problema`} label={cta} />
        </div>
      </section>

      {/* DEMO WHATSAPP */}
      <section className="px-6 py-14 max-w-2xl mx-auto w-full">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.2em] gradient-text font-semibold mb-3 text-center">
            Cum funcționează
          </p>
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-center">
            {niche.demo.title}
          </h2>
        </Reveal>
        <Reveal delay={1}>
          <div className="mt-8 rounded-3xl border border-border bg-[#0b141a] p-4 sm:p-6 shadow-xl">
            <div className="flex items-center gap-2 pb-3 border-b border-white/10">
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
              <span className="text-sm font-medium text-white/90">AdPilot</span>
            </div>
            <div className="mt-4 space-y-2.5">
              {niche.demo.lines.map((m, i) => (
                <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                      m.from === "me"
                        ? "bg-[#005c4b] text-white rounded-br-sm"
                        : "bg-[#202c33] text-white/95 rounded-bl-sm"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* PASI */}
      <section className="px-6 py-14 max-w-5xl mx-auto w-full">
        <Reveal>
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-center">
            Trei pași și ești live.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {niche.steps.map((s, i) => (
            <Reveal key={s.title} delay={i} className="relative rounded-2xl border border-border bg-background/50 p-7">
              <span className="absolute -top-3 left-7 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                {i + 1}
              </span>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 text-center">
          <SignupCTA id={`${niche.slug}-pasi`} label={cta} />
        </div>
      </section>

      {/* PLANURI */}
      <section className="px-6 py-14 max-w-4xl mx-auto w-full">
        <Reveal>
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-center">
            Începe gratuit. Crești când ești gata.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PLANS.map((p, i) => (
            <Reveal
              key={p.name}
              delay={i}
              className={`relative rounded-2xl p-7 ${p.featured ? "border-2 border-primary bg-primary/5" : p.free ? "border border-success/40 bg-success/5" : "border border-border"}`}
            >
              {p.free && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold bg-success text-white">Gratuit</span>}
              {p.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold bg-primary text-primary-foreground">Cel mai popular</span>}
              <h3 className="font-semibold text-lg">{p.name}</h3>
              {p.free ? (
                <>
                  <p className="mt-4 font-serif text-4xl">Gratuit</p>
                  <p className="mt-1 text-sm text-muted-foreground">{FREE_STARTER_SUBLABEL}</p>
                </>
              ) : (
                <>
                  <span className="mt-4 inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-success/15 text-success">🎉 {FIRST_MONTH_BADGE}</span>
                  <p className="mt-3 font-serif text-4xl">
                    {firstMonthPrice(p.price!).first}
                    <span className="text-sm text-muted-foreground font-sans"> prima lună</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">apoi {p.price}/lună</p>
                </>
              )}
              <ul className="mt-5 space-y-2">
                {p.items.map((it) => (
                  <li key={it} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-success" /> {it}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                search={{ mode: "signup" } as never}
                onClick={() => tkClickButton(`niche-${niche.slug}-plan-${p.name}`)}
                className={`press mt-6 inline-flex w-full items-center justify-center px-4 py-3 rounded-xl text-sm font-semibold ${p.featured ? "btn-primary" : p.free ? "bg-success text-white" : "glass hover:bg-card text-foreground"}`}
              >
                {p.free ? "Începe gratuit" : "Începe cu -50%"}
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-14 max-w-3xl mx-auto w-full">
        <Reveal>
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-center mb-8">
            Întrebări frecvente
          </h2>
        </Reveal>
        <div className="space-y-3">
          {niche.faq.map((f, i) => (
            <Reveal key={f.q} delay={i} className="card-floating p-6">
              <h3 className="font-semibold">{f.q}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="px-6 py-20 max-w-3xl mx-auto w-full text-center">
        <Reveal>
          <h2 className="font-serif text-4xl sm:text-5xl font-semibold tracking-tight text-balance">
            Prima ta clientă din reclame e la un pas.
          </h2>
          <p className="mt-4 text-muted-foreground">Fără card, fără agenție, fără experiență. Începe gratuit chiar acum.</p>
          <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground">
            <Facebook className="w-5 h-5 text-[#1877F2]" />
            <Instagram className="w-5 h-5 text-[#E4405F]" />
            <MessageCircle className="w-5 h-5 text-[#25D366]" />
          </div>
          <div className="mt-8">
            <SignupCTA id={`${niche.slug}-final`} label="Începe gratuit acum" className="text-lg px-8 py-4" />
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
