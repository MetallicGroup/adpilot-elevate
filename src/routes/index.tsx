import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostAuthPath } from "@/lib/post-auth";
import {
  ArrowRight, Check, MessageCircle, Bot, Inbox, LineChart, Zap, Rocket, Target,
  Star, PlayCircle, Facebook, Instagram, ShoppingBag, CalendarCheck, Users,
} from "lucide-react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { CommandStage } from "@/components/marketing/CommandStage";
import { HeroVideo } from "@/components/marketing/HeroVideo";
import { CountUp } from "@/components/wow/CountUp";
import { Reveal } from "@/components/wow/Reveal";
import { GoalPicker } from "@/components/marketing/GoalPicker";
import { tkViewContent, tkClickButton } from "@/lib/tiktok-pixel";
import { firstMonthPrice, FIRST_MONTH_BADGE, FREE_STARTER_LABEL, FREE_STARTER_SUBLABEL } from "@/lib/promo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AdPilot — Tu conduci afacerea. AdPilot conduce reclamele." },
      { name: "description", content: "Tu conduci afacerea. AdPilot conduce reclamele: creează, lansează și optimizează campanii Facebook și Instagram, iar lead-urile vin pe WhatsApp. 3 zile gratuit." },
      { property: "og:title", content: "AdPilot — Tu conduci afacerea. AdPilot conduce reclamele." },
      { property: "og:description", content: "Spune-i ce vrei să obții. AdPilot creează, lansează și optimizează reclamele tale Facebook și Instagram. 3 zile gratuit." },
      { property: "og:url", content: "https://adpilot.ro/" },
    ],
    links: [{ rel: "canonical", href: "https://adpilot.ro/" }],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    tkViewContent({ contentId: "home", contentName: "Homepage" });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function redirectSignedInUser() {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "",
      );
      const looksLikeAuthReturn =
        params.has("code") ||
        params.has("error") ||
        params.has("error_description") ||
        hashParams.has("access_token") ||
        hashParams.has("refresh_token") ||
        hashParams.has("type") ||
        hashParams.has("error");

      if (looksLikeAuthReturn) {
        navigate({
          to: "/auth/callback",
          search: Object.fromEntries(params.entries()),
          hash: window.location.hash.startsWith("#") ? window.location.hash.slice(1) : undefined,
          replace: true,
        });
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session || cancelled) return;
      const dest = await resolvePostAuthPath();
      if (!cancelled) navigate({ to: dest, replace: true });
    }

    redirectSignedInUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN") return;
      void redirectSignedInUser();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="relative px-6 pt-24 pb-32 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full pointer-events-none float-orb"
             style={{ background: "var(--gradient-glow)" }} />
        <div className="absolute top-40 right-0 w-[500px] h-[500px] rounded-full pointer-events-none opacity-50"
             style={{ background: "radial-gradient(circle, oklch(0.7 0.2 320 / 0.15), transparent 70%)" }} />

        <div className="relative max-w-6xl mx-auto w-full">
          <div className="grid md:grid-cols-2 gap-12 md:gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center md:text-left"
            >
              <motion.div
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="eyebrow"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-success pulse-dot text-success" />
                ✨ 3 zile gratuit · prima plată abia din ziua a 4-a
              </motion.div>

              <h1 className="mt-7 text-[2.45rem] leading-[1.06] sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight">
                Spune-i ce vrei să obții.{" "}
                <span className="gradient-text">AdPilot se ocupă de reclame.</span>
              </h1>

              <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto md:mx-0">
                Mai multe vânzări, programări sau clienți. AdPilot creează, lansează și optimizează reclamele tale pe Facebook și Instagram — fără agenție și fără experiență.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <a href="#obiectiv" className="press btn-primary inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-4 rounded-xl font-semibold">
                  Spune-i lui AdPilot ce vreau <ArrowRight className="w-4 h-4" />
                </a>
                <Link to="/contact" className="press inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-4 glass rounded-xl font-medium text-foreground hover:bg-card transition-colors">
                  <PlayCircle className="w-4 h-4" /> Vezi cum funcționează
                </Link>
              </div>

              <HeroVideo />

              <p className="mt-5 text-[13px] text-muted-foreground">
                3 zile gratuit · Fără experiență necesară · Configurare în câteva minute
              </p>

              <div className="mt-8 flex items-center justify-center md:justify-start gap-3 text-sm text-muted-foreground">
                <div className="flex">
                  {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
                </div>
                <span>Iubit de 200+ afaceri din România 🇷🇴</span>
              </div>
            </motion.div>

            <CommandStage />
          </div>
        </div>
      </section>

      {/* GOAL PICKER */}
      <section id="obiectiv" className="px-6 py-20 sm:py-24 max-w-6xl mx-auto w-full scroll-mt-24">
        <Reveal className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs uppercase tracking-[0.2em] gradient-text font-semibold mb-4">Începe de aici</p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">Tu ce vrei să obții?</h2>
          <p className="mt-4 text-muted-foreground">Alege obiectivul. De restul se ocupă AdPilot.</p>
        </Reveal>
        <GoalPicker />
      </section>

      <Divider text="Fără Ads Manager. Fără bătăi de cap." />

      {/* HOW IT WORKS */}
      <Section eyebrow="Cum funcționează" title="De la zero la campanie live în 5 minute">
        <p className="text-center text-muted-foreground -mt-6 mb-12 max-w-xl mx-auto">Fără agenție. Fără curbă de învățare. Doar rezultate.</p>
        <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="glass p-6 rounded-2xl"
            >
              <div className="font-mono text-2xl gradient-text font-bold">0{i + 1}</div>
              <s.icon className="w-5 h-5 mt-4 text-primary" />
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      <Divider text="De la idee la reclamă activă. În câteva minute." />

      {/* PLATFORMS WE MANAGE */}
      <Section eyebrow="Platformele pe care le gestionăm" title="Facebook, Instagram & WhatsApp — într-un singur loc.">
        <div className="grid md:grid-cols-3 gap-5">
          <div className="glass p-6 rounded-2xl">
            <Facebook className="w-8 h-8 text-primary" />
            <h3 className="mt-4 font-semibold">Facebook</h3>
            <p className="mt-2 text-sm text-muted-foreground">Campanii Lead Generation și Conversii, optimizate automat de AI.</p>
          </div>
          <div className="glass p-6 rounded-2xl">
            <Instagram className="w-8 h-8 text-primary" />
            <h3 className="mt-4 font-semibold">Instagram</h3>
            <p className="mt-2 text-sm text-muted-foreground">Reels, Stories și Feed — ești acolo unde clienții tăi petrec timpul.</p>
          </div>
          <div className="glass p-6 rounded-2xl">
            <MessageCircle className="w-8 h-8 text-primary" />
            <h3 className="mt-4 font-semibold">WhatsApp AI</h3>
            <p className="mt-2 text-sm text-muted-foreground">Control total și rapoarte zilnice, direct din conversație.</p>
          </div>
        </div>
      </Section>

      {/* FEATURES BENTO */}
      <Section eyebrow="Funcționalități" title="Tot ce ai nevoie. Nimic în plus.">
        <div className="grid md:grid-cols-3 gap-4">
          <BentoCard className="md:col-span-2 md:row-span-2 min-h-[320px]" icon={LineChart} title="Dashboard în timp real">
            <p>Vezi tot ce contează într-un singur loc: cheltuieli, lead-uri, CTR, CPL, ROAS. Actualizat la fiecare minut.</p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Mini label="Cheltuit" value="740 lei" />
              <Mini label="Clienți noi" value="23" />
              <Mini label="Cost/client" value="32 lei" />
            </div>
            <div className="mt-4 h-24 rounded-xl bg-background border border-border flex items-end gap-1 p-3">
              {[40, 65, 50, 80, 45, 90, 70].map((h, i) => (
                <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: "var(--gradient-primary)" }} />
              ))}
            </div>
          </BentoCard>
          <BentoCard icon={Bot} title="AI Campaign Builder">
            <p>AI-ul generează audiențe, text și structura campaniei pe baza obiectivului tău. Tu doar dai launch. ✨</p>
          </BentoCard>
          <BentoCard icon={MessageCircle} title="WhatsApp AI">
            <p>«Pornește reclama» · «Câte lead-uri azi?» — AdPilot înțelege română și execută instant.</p>
            <div className="mt-4 space-y-2 text-xs">
              <div className="bg-secondary rounded-lg p-2 max-w-[80%]">Câte lead-uri azi?</div>
              <div className="rounded-lg p-2 max-w-[80%] ml-auto text-white" style={{ background: "var(--gradient-primary)" }}>
                47 lead-uri 🚀
              </div>
            </div>
          </BentoCard>
          <BentoCard icon={Inbox} title="Lead Inbox">
            <p>Fiecare lead ajunge instant în inbox + notificare WhatsApp. Nu mai pierzi niciun client. 📨</p>
          </BentoCard>
          <BentoCard icon={Zap} title="Optimizare automată">
            <p>AdPilot identifică reclamele performante și redistribuie bugetul automat. Tu dormi, el optimizează. 😴</p>
          </BentoCard>
          <BentoCard icon={CalendarCheck} title="Programări & Booking">
            <p>Pagini de programare cu calendar integrat — clienții își rezervă singuri, tu primești notificare pe WhatsApp. 📅</p>
          </BentoCard>
        </div>
      </Section>

      {/* AGENCY */}
      <section className="px-6 py-20 sm:py-24 max-w-6xl mx-auto w-full">
        <Reveal className="glass rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Reclamele tale, <span className="gradient-text">fără agenție.</span>
          </h2>
          <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg leading-relaxed text-muted-foreground">
            Fără comisioane lunare, fără rapoarte pe care nu le înțelegi și fără să aștepți trei zile pentru o modificare. AdPilot lucrează non-stop, la o fracțiune din costul unei agenții.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3 text-left text-sm">
            {[
              "Costuri fixe, transparente — de la 249 lei pe lună",
              "Modificări instant, direct de pe WhatsApp",
              "Contul de reclame rămâne 100% al tău",
            ].map((t) => (
              <div key={t} className="flex items-start gap-2 rounded-xl border border-border bg-card/60 p-4">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> <span>{t}</span>
              </div>
            ))}
          </div>
          <Link to="/auth" onClick={() => tkClickButton("home-hero-cta")} className="press btn-primary mt-8 inline-flex items-center gap-2 rounded-xl px-6 sm:px-7 py-4 font-semibold">
            Înlocuiește complexitatea cu AdPilot <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </section>

      {/* VERTICALS */}
      <Section eyebrow="Pentru afacerea ta" title="Funcționează în orice domeniu.">
        <div className="grid gap-4 md:grid-cols-3">
          {verticals.map((v, i) => (
            <Reveal key={v.title} delay={i}>
              <div className="h-full rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/40">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "oklch(0.62 0.22 295 / 0.15)" }}>
                  <v.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Divider text="AdPilot muncește. Tu urmărești rezultatele." />

      {/* STATS */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto relative rounded-3xl p-12 md:p-16 overflow-hidden border" style={{ borderColor: "oklch(0.62 0.22 295 / 0.3)", background: "linear-gradient(135deg, oklch(0.16 0.014 285), oklch(0.13 0.012 285))" }}>
          <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
               style={{ background: "var(--gradient-glow)" }} />
          <div className="relative grid md:grid-cols-3 gap-10 text-center">
            {[
              { n: 200, suffix: "+", l: "Afaceri din România" },
              { n: 12, suffix: "M+ lei", l: "Buget gestionat" },
              { n: 4.2, suffix: "x", dec: 1, l: "ROAS mediu" },
            ].map((s) => (
              <div key={s.l} className="md:border-r md:last:border-r-0 border-border">
                <p className="font-mono text-5xl md:text-6xl font-bold gradient-text">
                  <CountUp to={s.n} decimals={s.dec ?? 0} suffix={s.suffix} />
                </p>
                <p className="mt-3 text-sm text-muted-foreground">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHATSAPP SECTION */}
      <Section eyebrow="💬 Asistent WhatsApp AI" title="Manager-ul tău de reclame. Pe WhatsApp.">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Trimite un mesaj. Primești rezultate. AdPilot înțelege română și engleză — și execută instant.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                "«Pornește reclama» — pornește campania instant",
                "«Câte lead-uri azi?» — statistici în timp real",
                "Alertă instant când vine un lead nou",
                "Raport zilnic dimineața, automat",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm">
                  <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute -inset-10 pointer-events-none" style={{ background: "var(--gradient-glow)" }} />
            <div className="relative mx-auto max-w-xs rounded-[2.5rem] border-8 p-2 shadow-2xl" style={{ borderColor: "oklch(0.2 0.014 285)", background: "oklch(0.1 0.012 285)" }}>
              <div className="rounded-[1.8rem] p-4 space-y-3 text-sm" style={{ background: "oklch(0.12 0.012 285)", minHeight: "440px" }}>
                <div className="text-center text-xs text-muted-foreground pb-2 border-b border-border">AdPilot AI · azi</div>
                <div className="bg-secondary rounded-2xl rounded-tl-sm p-3 max-w-[85%]">Salut! 👋 Cum te pot ajuta azi?</div>
                <div className="rounded-2xl rounded-tr-sm p-3 max-w-[85%] ml-auto text-white" style={{ background: "var(--gradient-primary)" }}>Câte lead-uri azi?</div>
                <div className="bg-secondary rounded-2xl rounded-tl-sm p-3 max-w-[85%]">23 lead-uri 📈<br/>+5 față de ieri</div>
                <div className="rounded-2xl rounded-tr-sm p-3 max-w-[85%] ml-auto text-white" style={{ background: "var(--gradient-primary)" }}>Pornește campania nouă</div>
                <div className="bg-secondary rounded-2xl rounded-tl-sm p-3 max-w-[85%]">✅ Gata! Campania e live.<br/>Reach estimat: 80.000/zi</div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* TESTIMONIALS */}
      <Section eyebrow="❤️ Iubit de antreprenori" title="Rezultate reale, în 30 de zile.">
        <div className="grid md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="card-floating p-6 flex flex-col"
            >
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(s => <Star key={s} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />)}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-foreground/90 flex-1">„{t.quote}"</p>
              <div className="mt-5 flex items-center gap-3 pt-4 border-t border-border">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                  style={{ background: `linear-gradient(135deg, oklch(0.62 0.22 ${t.hue}), oklch(0.7 0.2 ${t.hue + 30}))` }}
                >
                  {t.name.split(" ").map(n => n[0]).slice(0,2).join("")}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.role}</p>
                </div>
                <span className="ml-auto text-[10px] uppercase tracking-wider font-mono text-primary">{t.metric}</span>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-60">
          {["Glamora", "MaxAuto", "Casa Verde", "Petshop.ro", "EduPlus", "FitZone"].map((b) => (
            <span key={b} className="font-serif text-lg text-muted-foreground tracking-tight">{b}</span>
          ))}
        </div>
      </Section>

      {/* PRICING */}
      <Section eyebrow="Prețuri" title="Simple. Transparente.">
        <p className="text-center -mt-6 mb-3">
          <span className="inline-block text-sm font-bold px-3 py-1 rounded-full bg-success/15 text-success">
            🎉 Ofertă: -50% în prima lună pe orice plan
          </span>
        </p>
        <p className="text-center text-muted-foreground mb-12">Începe gratuit. Upgrade când ești gata. 💎</p>
        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {plans.map((p) => (
            <div key={p.name} className={`relative rounded-2xl p-8 ${p.featured ? "border-2" : "border card-floating"}`}
                 style={p.featured ? { borderColor: "oklch(0.62 0.22 295 / 0.6)", background: "linear-gradient(160deg, oklch(0.18 0.02 285), oklch(0.14 0.012 285))", boxShadow: "var(--shadow-glow)" } : {}}>
              {p.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: "var(--gradient-primary)" }}>
                  Cel mai popular
                </span>
              )}
              <h3 className="font-semibold text-lg">{p.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
              {p.free ? (
                <>
                  <div className="mt-6">
                    <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-success/15 text-success">
                      ✅ {FREE_STARTER_LABEL}
                    </span>
                  </div>
                  <p className="mt-3 font-bold text-5xl">Gratuit</p>
                  <p className="mt-1 text-sm text-muted-foreground">{FREE_STARTER_SUBLABEL} · fără card</p>
                </>
              ) : (
                <>
                  <div className="mt-6">
                    <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/15 text-primary">
                      🎉 {FIRST_MONTH_BADGE}
                    </span>
                  </div>
                  <p className="mt-3 font-bold text-5xl">
                    {firstMonthPrice(p.price).first}
                    <span className="text-base text-muted-foreground font-normal"> prima lună</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    apoi <span className="text-foreground font-medium">{p.price}</span>/lună
                  </p>
                </>
              )}
              <ul className="mt-6 space-y-3">
                {p.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />{it}
                  </li>
                ))}
              </ul>
              <Link to="/auth" onClick={() => tkClickButton(`home-plan-${p.name}`)} className={`press mt-7 inline-flex w-full items-center justify-center px-4 py-3 rounded-xl text-sm font-semibold ${p.featured ? "btn-primary" : "glass hover:bg-card text-foreground"}`}>
                Începe gratuit
              </Link>
              <p className="mt-3 text-xs text-center text-muted-foreground">3 zile gratuit · anulezi oricând</p>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section eyebrow="Întrebări frecvente" title="Răspunsuri rapide. Promitem.">
        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((f, i) => (
            <details key={i} className="glass rounded-xl p-6 group">
              <summary className="flex items-center justify-between cursor-pointer font-medium list-none">
                <span>{f.q}</span>
                <span className="text-muted-foreground group-open:rotate-45 transition-transform text-xl leading-none">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* AGENȚII */}
      <section className="px-6 pb-4">
        <Reveal className="max-w-4xl mx-auto">
          <div className="glass rounded-2xl border border-border p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] gradient-text font-semibold mb-2">
                Pentru agenții
              </p>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
                Ești agenție de marketing?
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground max-w-lg">
                Gestionează reclamele tuturor clienților tăi dintr-un singur loc. Clienții se
                conectează singuri printr-un link.
              </p>
            </div>
            <Link
              to="/agentie"
              className="press inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-primary/40 font-semibold hover:bg-primary/10 transition-colors whitespace-nowrap"
            >
              AdPilot pentru agenții <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* FINAL CTA */}
      <section className="relative px-6 py-32 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full pointer-events-none"
             style={{ background: "var(--gradient-glow)" }} />
        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-extrabold tracking-tight text-balance">
            Care este <span className="gradient-text">obiectivul afacerii tale?</span>
          </h2>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground">
            Spune-i lui AdPilot. De restul ne ocupăm noi.
          </p>
          <a href="#obiectiv" className="press btn-primary mt-9 inline-flex items-center gap-2 px-7 sm:px-8 py-4 rounded-xl text-base sm:text-lg font-semibold">
            Vreau să încep <ArrowRight className="w-5 h-5" />
          </a>
          <p className="mt-5 text-[13px] text-muted-foreground">
            3 zile gratuit · anulezi oricând · fără costuri ascunse
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="px-6 py-24 max-w-6xl mx-auto w-full">
      <Reveal className="text-center max-w-2xl mx-auto mb-12">
        <p className="text-xs uppercase tracking-[0.2em] gradient-text font-semibold mb-4">{eyebrow}</p>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-balance">{title}</h2>
      </Reveal>
      {children}
    </section>
  );
}

function Divider({ text }: { text: string }) {
  return (
    <section className="px-6 py-16 sm:py-24">
      <Reveal className="mx-auto max-w-4xl text-center">
        <p className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight text-balance text-foreground/90">
          {text}
        </p>
      </Reveal>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background p-3 border border-border">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono font-bold">{value}</p>
    </div>
  );
}

function BentoCard({ icon: Icon, title, children, className = "" }: { icon: any; title: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.4 }}
      className={`rounded-2xl p-7 border border-border bg-card hover:border-border/80 transition-all hover:-translate-y-1 ${className}`}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "oklch(0.62 0.22 295 / 0.15)" }}>
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <div className="mt-2 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </motion.div>
  );
}

const verticals = [
  { icon: ShoppingBag, title: "E-commerce", body: "Reclame care duc clienții direct la produsele tale și campanii de conversii optimizate zilnic pentru vânzări, nu pentru like-uri." },
  { icon: CalendarCheck, title: "Programări", body: "Salon, clinică sau service: primești o pagină de programări proprie și reclame optimizate pentru rezervări confirmate." },
  { icon: Users, title: "Servicii & lead gen", body: "Formulare native Facebook, lead-uri livrate instant pe WhatsApp și follow-up automat, ca să nu pierzi niciun client." },
];

const steps = [
  { icon: Zap, title: "Conectează Facebook", body: "OAuth securizat. Durează 30 de secunde." },
  { icon: Target, title: "Spune-ne obiectivul", body: "Lead-uri sau vânzări? Buget? Restul rezolvăm noi." },
  { icon: Bot, title: "AI construiește campania", body: "Audiențe, text, structură — totul generat." },
  { icon: Rocket, title: "Lansează", body: "Un click și ești live pe Facebook & Instagram." },
  { icon: MessageCircle, title: "Primești lead-uri", body: "Direct pe WhatsApp, instant." },
];

const plans = [
  { name: "Starter", tagline: "Testează gratuit, fără card.", price: "Gratuit", free: true, items: ["Asistent WhatsApp AI inclus", "Campanii pe Facebook & Instagram", "3 zile gratuit în fiecare lună"] },
  { name: "Pro", tagline: "Pentru afacerile care cresc rapid.", price: "495 lei", featured: true, items: ["Campanii nelimitate, non-stop", "10 poze AI pe lună", "Asistent WhatsApp AI", "Suport prioritar"] },
  { name: "Premium", tagline: "Pentru branduri și agenții care scalează.", price: "995 lei", items: ["Campanii nelimitate, non-stop", "Poze AI nelimitate", "Asistent WhatsApp AI", "Manager dedicat"] },
];

const faqs = [
  { q: "Am nevoie de o agenție de marketing ca să folosesc AdPilot?", a: "Nu. AdPilot e construit exact pentru afacerile care vor să facă reclame Facebook & Instagram fără agenție. AI-ul se ocupă de audiențe, text și structura campaniei." },
  { q: "Trebuie să am experiență cu reclame Facebook?", a: "Deloc. Dacă poți răspunde la câteva întrebări despre afacerea ta și obiectiv, AdPilot creează și lansează campania pentru tine." },
  { q: "Cum funcționează asistentul WhatsApp?", a: "Conectezi numărul tău de WhatsApp, iar apoi poți trimite comenzi în limbaj natural: «câte lead-uri azi?» sau «pornește campania nouă». AdPilot înțelege și execută instant." },
  { q: "Sunt datele mele în siguranță?", a: "Da. Ne conectăm prin OAuth oficial Meta, nu stocăm nicio parolă, iar toate datele sunt criptate. Suntem 100% conformi GDPR." },
  { q: "Cine deține contul de reclame?", a: "Tu. Contul Meta Business rămâne mereu pe numele tău. AdPilot doar acționează la instrucțiunile tale și poți retrage accesul oricând." },
  { q: "Costul include bugetul de reclame?", a: "Nu. Abonamentul AdPilot acoperă doar platforma. Bugetul de reclame e plătit direct către Meta, din contul tău." },
  { q: "Pot anula oricând?", a: "Da. Anulezi din dashboard în orice moment. Accesul continuă până la finalul perioadei plătite." },
  { q: "În ce limbi vorbește AI-ul?", a: "Română și engleză. Tot AdPilot e localizat în română — interfață, asistent, rapoarte, totul." },
];

type Testimonial = { name: string; role: string; quote: string; metric: string; hue: number };

const testimonials: Testimonial[] = [
  { name: "Andreea Marin", role: "Fondator · Glamora Beauty", quote: "Am lansat prima campanie Facebook în 4 minute. În 2 săptămâni: 312 lead-uri și 18 cliente noi.", metric: "+312 lead-uri", hue: 320 },
  { name: "Radu Constantin", role: "CEO · MaxAuto Service", quote: "AdPilot mi-a tăiat costurile cu 40% față de agenția anterioară. Și răspunde pe WhatsApp în 2 secunde.", metric: "−40% cost", hue: 250 },
  { name: "Mihaela Popa", role: "Marketing · Casa Verde", quote: "Lead-urile vin direct pe telefon. Nu mai stau să verific dashboard-ul de 10 ori pe zi. E magie.", metric: "ROAS 5,2x", hue: 155 },
];