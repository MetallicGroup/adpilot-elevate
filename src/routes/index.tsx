import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight, Check, MessageCircle, Bot, Inbox, LineChart, Zap, Rocket, Target,
  Star, PlayCircle,
} from "lucide-react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { IphoneWhatsAppMockup } from "@/components/marketing/IphoneWhatsAppMockup";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AdPilot — Reclame TikTok. Fără agenție." },
      { name: "description", content: "Platforma AI care creează, lansează și optimizează reclame TikTok în minute. Lead-urile vin direct pe WhatsApp." },
      { property: "og:title", content: "AdPilot — Reclame TikTok. Fără agenție." },
      { property: "og:description", content: "Platforma AI care creează, lansează și optimizează reclame TikTok. Lead-urile vin direct pe WhatsApp." },
    ],
  }),
  component: Index,
});

function Index() {
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
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-medium text-muted-foreground"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-success pulse-dot text-success" />
                ✨ Live acum — campanii în 60 de secunde
              </motion.div>

              <h1 className="mt-8 text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight">
                Reclame TikTok.<br/>
                <span className="gradient-text">Fără agenție.</span>
              </h1>

              <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto md:mx-0">
                AdPilot creează, lansează și optimizează campaniile tale TikTok în câteva minute — iar fiecare lead ajunge direct pe WhatsApp-ul tău. ✨
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <Link to="/auth" className="press btn-primary inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl font-semibold">
                  Începe gratuit <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/contact" className="press inline-flex items-center justify-center gap-2 px-7 py-4 glass rounded-xl font-medium text-foreground hover:bg-card transition-colors">
                  <PlayCircle className="w-4 h-4" /> Vezi demo
                </Link>
              </div>

              <div className="mt-10 flex items-center justify-center md:justify-start gap-3 text-sm text-muted-foreground">
                <div className="flex">
                  {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
                </div>
                <span>Iubit de 200+ afaceri din România 🇷🇴</span>
              </div>
            </motion.div>

            <div className="flex justify-center md:justify-end">
              <IphoneWhatsAppMockup />
            </div>
          </div>

          {/* Dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-20 relative max-w-5xl mx-auto"
            style={{ perspective: "2000px" }}
          >
            <div className="card-floating-lg p-6 md:p-8 grid md:grid-cols-3 gap-4"
                 style={{ transform: "rotateX(6deg)", boxShadow: "0 50px 100px -20px oklch(0.62 0.22 295 / 0.4), 0 30px 60px -30px oklch(0 0 0 / 0.7)" }}>
              <KpiTile label="Cheltuiți azi" value="€1.284" delta="+12%" />
              <KpiTile label="Lead-uri azi" value="47" delta="+23%" />
              <KpiTile label="CPL mediu" value="€6,40" delta="-8%" />
              <div className="md:col-span-2 rounded-xl bg-secondary p-6 border border-border">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Campanie activă</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success pulse-dot text-success" />
                  <p className="font-semibold">Reduceri de Primăvară · Lead Gen</p>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-2 flex-1 rounded-full bg-background overflow-hidden">
                    <div className="h-full w-3/4 rounded-full" style={{ background: "var(--gradient-primary)" }} />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">€750 / €1.000</span>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                  <Mini label="CTR" value="3,2%" />
                  <Mini label="CPL" value="€6,40" />
                  <Mini label="ROAS" value="4,1x" />
                </div>
              </div>
              <div className="rounded-xl p-5 flex flex-col border border-border" style={{ background: "linear-gradient(160deg, oklch(0.18 0.02 285), oklch(0.14 0.012 285))" }}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp AI
                </div>
                <div className="mt-4 space-y-3 text-sm flex-1">
                  <div className="bg-secondary rounded-2xl rounded-tl-sm p-3">Câte lead-uri azi?</div>
                  <div className="rounded-2xl rounded-tr-sm p-3 ml-6 text-white" style={{ background: "var(--gradient-primary)" }}>
                    47 lead-uri — cu 23% mai mult decât ieri 🚀
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <Section eyebrow="Cum funcționează" title="De la zero la campanie live în 5 minute">
        <p className="text-center text-muted-foreground -mt-6 mb-12 max-w-xl mx-auto">Fără agenție. Fără curbă de învățare. Doar rezultate.</p>
        <div className="grid md:grid-cols-5 gap-4">
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

      {/* FEATURES BENTO */}
      <Section eyebrow="Funcționalități" title="Tot ce ai nevoie. Nimic în plus.">
        <div className="grid md:grid-cols-3 gap-4">
          <BentoCard className="md:col-span-2 md:row-span-2 min-h-[320px]" icon={LineChart} title="Dashboard în timp real">
            <p>Vezi tot ce contează într-un singur loc: cheltuieli, lead-uri, CTR, CPL, ROAS. Actualizat la fiecare minut.</p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Mini label="Spend" value="€148" />
              <Mini label="Lead-uri" value="23" />
              <Mini label="CPL" value="€6,40" />
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
        </div>
      </Section>

      {/* STATS */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto relative rounded-3xl p-12 md:p-16 overflow-hidden border" style={{ borderColor: "oklch(0.62 0.22 295 / 0.3)", background: "linear-gradient(135deg, oklch(0.16 0.014 285), oklch(0.13 0.012 285))" }}>
          <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
               style={{ background: "var(--gradient-glow)" }} />
          <div className="relative grid md:grid-cols-3 gap-10 text-center">
            {[
              { v: "200+", l: "Afaceri din România" },
              { v: "€2.4M+", l: "Buget gestionat" },
              { v: "4,2x", l: "ROAS mediu" },
            ].map((s) => (
              <div key={s.l} className="md:border-r md:last:border-r-0 border-border">
                <p className="font-mono text-5xl md:text-6xl font-bold gradient-text">{s.v}</p>
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
        <p className="text-center text-muted-foreground -mt-6 mb-12">Începe gratuit. Upgrade când ești gata. 💎</p>
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
              <p className="mt-6 font-bold text-5xl">{p.price}<span className="text-base text-muted-foreground font-normal">/lună</span></p>
              <ul className="mt-6 space-y-3">
                {p.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />{it}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className={`press mt-7 inline-flex w-full items-center justify-center px-4 py-3 rounded-xl text-sm font-semibold ${p.featured ? "btn-primary" : "glass hover:bg-card text-foreground"}`}>
                Începe gratuit
              </Link>
              <p className="mt-3 text-xs text-center text-muted-foreground">14 zile gratuit · fără card</p>
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

      {/* FINAL CTA */}
      <section className="relative px-6 py-32 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full pointer-events-none"
             style={{ background: "var(--gradient-glow)" }} />
        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight">
            Gata să lansezi <span className="gradient-text">prima ta reclamă?</span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">Gratuit 14 zile. Fără card. Anulezi oricând. 🎉</p>
          <Link to="/auth" className="press btn-primary mt-10 inline-flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold">
            Începe acum <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="px-6 py-24 max-w-6xl mx-auto w-full">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <p className="text-xs uppercase tracking-[0.2em] gradient-text font-semibold mb-4">{eyebrow}</p>
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function KpiTile({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="rounded-xl bg-secondary p-5 border border-border">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-success">{delta} față de ieri</p>
    </div>
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

const steps = [
  { icon: Zap, title: "Conectează TikTok", body: "OAuth securizat. Durează 30 de secunde." },
  { icon: Target, title: "Spune-ne obiectivul", body: "Lead-uri sau vânzări? Buget? Restul rezolvăm noi." },
  { icon: Bot, title: "AI construiește campania", body: "Audiențe, text, structură — totul generat." },
  { icon: Rocket, title: "Lansează", body: "Un click și ești live pe TikTok." },
  { icon: MessageCircle, title: "Primești lead-uri", body: "Direct pe WhatsApp, instant." },
];

const plans = [
  { name: "Starter", tagline: "Pentru afaceri mici care încep.", price: "€99", items: ["1 cont de reclame", "Buget până la €2.000/lună", "AI Campaign Builder", "Suport pe email"] },
  { name: "Growth", tagline: "Pentru afaceri care cresc rapid.", price: "€199", featured: true, items: ["3 conturi de reclame", "Buget până la €10.000/lună", "Asistent WhatsApp AI", "Optimizare automată", "Suport prioritar"] },
  { name: "Pro", tagline: "Pentru agenții și branduri mari.", price: "€399", items: ["Conturi nelimitate", "Buget nelimitat", "Success manager dedicat", "Integrări personalizate", "SLA 99,9%"] },
];

const faqs = [
  { q: "Am nevoie de o agenție de marketing ca să folosesc AdPilot?", a: "Nu. AdPilot e construit exact pentru afacerile care vor să facă reclame TikTok fără agenție. AI-ul se ocupă de audiențe, text și structura campaniei." },
  { q: "Trebuie să am experiență cu reclame TikTok?", a: "Deloc. Dacă poți răspunde la câteva întrebări despre afacerea ta și obiectiv, AdPilot creează și lansează campania pentru tine." },
  { q: "Cum funcționează asistentul WhatsApp?", a: "Conectezi numărul tău de WhatsApp, iar apoi poți trimite comenzi în limbaj natural: «câte lead-uri azi?» sau «pornește campania nouă». AdPilot înțelege și execută instant." },
  { q: "Sunt datele mele în siguranță?", a: "Da. Ne conectăm prin OAuth oficial TikTok, nu stocăm nicio parolă, iar toate datele sunt criptate. Suntem 100% conformi GDPR." },
  { q: "Cine deține contul de reclame TikTok?", a: "Tu. Contul TikTok Business rămâne mereu pe numele tău. AdPilot doar acționează la instrucțiunile tale și poți retrage accesul oricând." },
  { q: "Costul include bugetul de reclame?", a: "Nu. Abonamentul AdPilot acoperă doar platforma. Bugetul de reclame e plătit direct către TikTok, din contul tău." },
  { q: "Pot anula oricând?", a: "Da. Anulezi din dashboard în orice moment. Accesul continuă până la finalul perioadei plătite." },
  { q: "În ce limbi vorbește AI-ul?", a: "Română și engleză. Tot AdPilot e localizat în română — interfață, asistent, rapoarte, totul." },
];

type Testimonial = { name: string; role: string; quote: string; metric: string; hue: number };

const testimonials: Testimonial[] = [
  { name: "Andreea Marin", role: "Fondator · Glamora Beauty", quote: "Am lansat prima campanie TikTok în 4 minute. În 2 săptămâni: 312 lead-uri și 18 cliente noi.", metric: "+312 lead-uri", hue: 320 },
  { name: "Radu Constantin", role: "CEO · MaxAuto Service", quote: "AdPilot mi-a tăiat costurile cu 40% față de agenția anterioară. Și răspunde pe WhatsApp în 2 secunde.", metric: "−40% cost", hue: 250 },
  { name: "Mihaela Popa", role: "Marketing · Casa Verde", quote: "Lead-urile vin direct pe telefon. Nu mai stau să verific dashboard-ul de 10 ori pe zi. E magie.", metric: "ROAS 5,2x", hue: 155 },
];