import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import type { ReactNode } from "react";
import {
  Sparkles,
  Facebook,
  Instagram,
  MessageCircle,
  Rocket,
  Target,
  TrendingUp,
  Check,
  ArrowRight,
} from "lucide-react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Reveal } from "@/components/wow/Reveal";
import {
  firstMonthPrice,
  FIRST_MONTH_BADGE,
  FREE_STARTER_LABEL,
  FREE_STARTER_SUBLABEL,
} from "@/lib/promo";
import { tkViewContent, tkClickButton } from "@/lib/tiktok-pixel";

export const Route = createFileRoute("/oferta")({
  head: () => ({
    meta: [
      { title: "Începe GRATUIT — AdPilot" },
      {
        name: "description",
        content:
          "Spune-i ce vrei să obții. AdPilot creează, lansează și optimizează reclamele tale pe Facebook și Instagram — fără agenție și fără experiență. Începe gratuit, -50% în prima lună pe planurile plătite.",
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
function SignupCTA({ id, label = "Înregistrează-te acum", className = "" }: { id: string; label?: string; className?: string }) {
  return (
    <Link
      to="/auth"
      search={{ mode: "signup" } as never}
      onClick={() => tkClickButton(`oferta-${id}`)}
      className={`press btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-base font-semibold ${className}`}
    >
      {label} <ArrowRight className="w-5 h-5" />
    </Link>
  );
}

function Section({ eyebrow, title, children }: { eyebrow?: string; title: string; children: ReactNode }) {
  return (
    <section className="px-6 py-16 max-w-5xl mx-auto w-full">
      <Reveal>
        {eyebrow && (
          <p className="text-xs uppercase tracking-[0.2em] gradient-text font-semibold mb-3 text-center">
            {eyebrow}
          </p>
        )}
        <h2 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-center">
          {title}
        </h2>
      </Reveal>
      <div className="mt-10">{children}</div>
    </section>
  );
}

function OfertaPage() {
  useEffect(() => {
    tkViewContent({ contentId: "oferta", contentName: "Oferta" });
  }, []);

  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="px-6 pt-20 pb-14 max-w-4xl mx-auto w-full text-center">
        <Reveal>
          <span className="inline-flex items-center gap-2 text-sm font-bold px-3.5 py-1.5 rounded-full bg-success/15 text-success">
            ✅ {FREE_STARTER_LABEL} · fără card
          </span>
        </Reveal>
        <Reveal delay={1}>
          <h1 className="mt-6 font-serif text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight text-balance">
            Începe <span className="gradient-text">GRATUIT</span>
          </h1>
        </Reveal>
        <Reveal delay={2}>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Spune-i ce vrei să obții. <b className="text-foreground">AdPilot se ocupă de reclame.</b>
          </p>
        </Reveal>
        <Reveal delay={3}>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Mai multe vânzări, programări sau clienți. AdPilot creează, lansează și optimizează
            reclamele tale pe Facebook și Instagram — <b className="text-foreground">fără agenție și
            fără experiență</b>.
          </p>
        </Reveal>
        <Reveal delay={4}>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <SignupCTA id="hero" label="Începe gratuit acum" className="text-lg px-8 py-4" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            🎉 Iar pe Pro & Premium ai <b className="text-foreground">-50% în prima lună</b> · Asistent
            WhatsApp AI inclus
          </p>
        </Reveal>
      </section>

      {/* CE E ADPILOT */}
      <Section eyebrow="Ce e AdPilot" title="Reclame profesioniste, fără să fii expert.">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: <Sparkles className="w-6 h-6" />,
              t: "Îi spui obiectivul",
              d: "„Vreau mai multe vânzări” sau „mai multe programări”. Atât. În română, pe înțelesul tău.",
            },
            {
              icon: <Rocket className="w-6 h-6" />,
              t: "AdPilot lansează",
              d: "Creează reclama, textele și targetarea, o pune live pe Facebook și Instagram automat.",
            },
            {
              icon: <TrendingUp className="w-6 h-6" />,
              t: "Optimizează singur",
              d: "Urmărește rezultatele zi de zi și ajustează campania ca să aduci clienți mai ieftin.",
            },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i} className="card-floating p-7">
              <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                {c.icon}
              </div>
              <h3 className="mt-4 font-semibold text-lg">{c.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 text-center">
          <SignupCTA id="ce-e" />
        </div>
      </Section>

      {/* CUM FUNCTIONEAZA */}
      <Section eyebrow="Cum funcționează" title="Trei pași și ești live.">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { n: "1", icon: <Facebook className="w-5 h-5" />, t: "Conectează Facebook", d: "Legi pagina și contul de reclame în câteva secunde." },
            { n: "2", icon: <Target className="w-5 h-5" />, t: "Alegi obiectivul", d: "Vânzări, programări, clienți sau apeluri — tu decizi." },
            { n: "3", icon: <MessageCircle className="w-5 h-5" />, t: "Pornești din WhatsApp", d: "Asistentul AdPilot lansează și îți raportează totul pe WhatsApp." },
          ].map((c, i) => (
            <Reveal key={c.n} delay={i} className="relative rounded-2xl border border-border bg-background/50 p-7">
              <span className="absolute -top-3 left-7 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                {c.n}
              </span>
              <div className="mt-2 flex items-center gap-2 text-primary">{c.icon}</div>
              <h3 className="mt-3 font-semibold">{c.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* DE CE FARA AGENTIE */}
      <Section eyebrow="De ce AdPilot" title="Cât o agenție. Fără costul unei agenții.">
        <div className="grid gap-4 sm:grid-cols-2 max-w-3xl mx-auto">
          {[
            "Fără comisioane de agenție și fără contracte lunare mari.",
            "Fără să înveți Facebook Ads Manager — vorbești normal, în română.",
            "Reclame live în minute, nu în săptămâni de emailuri.",
            "Rezultatele și banii cheltuiți, transparent, direct pe WhatsApp.",
          ].map((t, i) => (
            <Reveal key={t} delay={i} className="flex items-start gap-3 card-floating p-5">
              <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
              <p className="text-sm">{t}</p>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 text-center">
          <SignupCTA id="de-ce" />
        </div>
      </Section>

      {/* PLANURI */}
      <Section eyebrow="Planuri" title="Începe gratuit. Crești când ești gata.">
        <div className="grid gap-5 md:grid-cols-3 max-w-4xl mx-auto">
          {[
            { name: "Starter", free: true, price: "Gratuit", items: ["Asistent WhatsApp AI inclus", "Campanii pe Facebook & Instagram", "3 zile gratuit în fiecare lună"] },
            { name: "Pro", price: "495 lei", featured: true, items: ["Campanii nelimitate, non-stop", "10 poze AI / lună", "Asistent WhatsApp AI", "Suport prioritar"] },
            { name: "Premium", price: "995 lei", items: ["Campanii nelimitate, non-stop", "Poze AI nelimitate", "Asistent WhatsApp AI", "Manager dedicat"] },
          ].map((p, i) => (
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
                    {firstMonthPrice(p.price).first}
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
                onClick={() => tkClickButton(`oferta-plan-${p.name}`)}
                className={`press mt-6 inline-flex w-full items-center justify-center px-4 py-3 rounded-xl text-sm font-semibold ${p.featured ? "btn-primary" : p.free ? "bg-success text-white" : "glass hover:bg-card text-foreground"}`}
              >
                {p.free ? "Începe gratuit" : "Începe cu -50%"}
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* CTA FINAL */}
      <section className="px-6 py-20 max-w-3xl mx-auto w-full text-center">
        <Reveal>
          <h2 className="font-serif text-4xl sm:text-5xl font-semibold tracking-tight text-balance">
            Prima ta reclamă e la un pas.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Fără card, fără agenție, fără experiență. Începe gratuit chiar acum.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground">
            <Facebook className="w-5 h-5 text-[#1877F2]" />
            <Instagram className="w-5 h-5 text-[#E4405F]" />
            <MessageCircle className="w-5 h-5 text-[#25D366]" />
          </div>
          <div className="mt-8">
            <SignupCTA id="final" label="Începe gratuit acum" className="text-lg px-8 py-4" />
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
