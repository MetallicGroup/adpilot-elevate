import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight, Sparkles, BarChart3, Zap, Check, MessageCircle,
  ShieldCheck, Bot, Megaphone, Target, Rocket, Inbox, LineChart,
} from "lucide-react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AdPilot — Launch TikTok Ads in under 5 minutes" },
      { name: "description", content: "AdPilot is the AI platform that lets businesses create, manage and optimize TikTok ads — no agency, no technical skills required." },
      { property: "og:title", content: "AdPilot — Launch TikTok Ads in under 5 minutes" },
      { property: "og:description", content: "AI-powered TikTok ads platform with WhatsApp lead alerts, audience suggestions and one-click campaign launches." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="px-6 pt-20 pb-24 max-w-6xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-tiktok" />
            Official TikTok Marketing Partner Application
          </div>
          <h1 className="mt-6 font-serif text-5xl md:text-7xl font-semibold leading-[1.02] tracking-tight">
            Launch TikTok Ads in under <span className="text-tiktok">5 minutes</span>.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            AdPilot is the AI platform that lets businesses create, manage and optimize TikTok ads — without an agency, without technical skills.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/auth" className="press inline-flex items-center justify-center gap-2 px-8 py-4 bg-foreground text-background rounded-xl font-medium">
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/contact" className="press inline-flex items-center justify-center gap-2 px-8 py-4 border border-border rounded-xl font-medium hover:bg-secondary transition-colors">
              Book a Demo
            </Link>
          </div>
        </motion.div>

        {/* Product mockup */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          className="mt-16 relative max-w-5xl mx-auto"
        >
          <div className="card-floating-lg p-6 md:p-10 grid md:grid-cols-3 gap-5">
            <StatTile label="Spend today" value="$1,284" delta="+12%" />
            <StatTile label="Leads today" value="47" delta="+23%" />
            <StatTile label="Avg. CPL" value="$2.74" delta="-8%" good />
            <div className="md:col-span-2 rounded-2xl bg-secondary p-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Active campaign</p>
              <p className="mt-2 font-semibold text-lg">Spring Sale — Lead Gen</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-background overflow-hidden">
                  <div className="h-full w-3/4 bg-tiktok" />
                </div>
                <span className="text-xs text-muted-foreground">$750 / $1,000</span>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <Mini label="CTR" value="3.2%" />
                <Mini label="CPL" value="$2.41" />
                <Mini label="ROAS" value="4.1x" />
              </div>
            </div>
            <div className="rounded-2xl bg-foreground text-background p-6 flex flex-col">
              <div className="flex items-center gap-2 text-xs opacity-70">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp AI
              </div>
              <div className="mt-4 space-y-3 text-sm flex-1">
                <div className="bg-white/10 rounded-2xl rounded-tl-sm p-3">How many leads today?</div>
                <div className="bg-tiktok rounded-2xl rounded-tr-sm p-3 ml-6">47 leads — up 23% vs yesterday 🚀</div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* HOW IT WORKS */}
      <Section eyebrow="How it works" title="From zero to live campaign in 5 steps">
        <div className="grid md:grid-cols-5 gap-4">
          {steps.map((s, i) => (
            <div key={s.title} className="card-floating p-5">
              <div className="w-7 h-7 rounded-full bg-foreground text-background text-xs font-semibold flex items-center justify-center">{i + 1}</div>
              <h3 className="mt-4 font-semibold text-sm">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* FEATURES */}
      <Section eyebrow="Features" title="Everything you need to run TikTok ads">
        <div className="grid md:grid-cols-2 gap-5">
          {features.map((f) => (
            <div key={f.title} className="card-floating p-6">
              <f.icon className="w-5 h-5 text-tiktok" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              <ul className="mt-4 space-y-2">
                {f.items.map((it) => (
                  <li key={it} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-success" /> {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* AUDIENCE */}
      <Section eyebrow="Built for" title="Service, eCommerce, and Local businesses">
        <div className="grid md:grid-cols-3 gap-5">
          {audiences.map((a) => (
            <div key={a.title} className="card-floating p-6">
              <h3 className="font-semibold">{a.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {a.tags.map((t) => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-secondary">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* SECURITY */}
      <Section eyebrow="Security & Privacy" title="Your data. Your ad account. Your control.">
        <div className="card-floating-lg p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <ShieldCheck className="w-8 h-8 text-tiktok" />
              <p className="mt-4 text-muted-foreground leading-relaxed">
                AdPilot connects via secure TikTok OAuth. We never store your TikTok password, we never share your data with third parties, and your ad account always remains under your ownership.
              </p>
            </div>
            <ul className="space-y-3">
              {["OAuth Authentication", "GDPR Compliant", "Secure Encrypted Storage", "No Third-Party Data Sharing", "Advertiser owns the ad account"].map((i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <Check className="w-4 h-4 text-success" /> {i}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* INTEGRATIONS */}
      <Section eyebrow="Integrations" title="Works with the tools you use">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {["TikTok Ads", "WhatsApp", "Stripe", "Google Analytics", "Meta Pixel"].map((n) => (
            <div key={n} className="card-floating p-6 text-center text-sm font-medium">{n}</div>
          ))}
        </div>
      </Section>

      {/* PRICING TEASE */}
      <Section eyebrow="Pricing" title="Simple plans that scale with you">
        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((p) => (
            <div key={p.name} className={`card-floating p-7 ${p.featured ? "ring-2 ring-foreground" : ""}`}>
              {p.featured && <p className="text-xs font-medium text-tiktok mb-2">Most popular</p>}
              <h3 className="font-semibold text-lg">{p.name}</h3>
              <p className="mt-2 font-serif text-4xl">{p.price}<span className="text-base text-muted-foreground font-sans">/mo</span></p>
              <ul className="mt-5 space-y-2">
                {p.items.map((it) => (
                  <li key={it} className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-success" />{it}</li>
                ))}
              </ul>
              <Link to="/auth" className="press mt-6 inline-flex w-full items-center justify-center px-4 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium">
                Start Free Trial
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">14-day free trial. Cancel anytime.</p>
      </Section>

      {/* CTA */}
      <section className="px-6 py-24 max-w-4xl mx-auto w-full text-center">
        <h2 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight">Ready to launch your first TikTok ad?</h2>
        <p className="mt-4 text-muted-foreground">Free to start. No credit card required.</p>
        <Link to="/auth" className="press mt-8 inline-flex items-center gap-2 px-8 py-4 bg-foreground text-background rounded-xl font-medium">
          Start Free Trial <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </MarketingLayout>
  );
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="px-6 py-20 max-w-6xl mx-auto w-full">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">{eyebrow}</p>
        <h2 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StatTile({ label, value, delta, good }: { label: string; value: string; delta: string; good?: boolean }) {
  return (
    <div className="rounded-2xl bg-secondary p-6">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-3xl">{value}</p>
      <p className={`mt-1 text-xs ${good ? "text-success" : "text-foreground/70"}`}>{delta}</p>
    </div>
  );
}
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

const steps = [
  { title: "Connect TikTok", body: "Secure OAuth — no passwords stored." },
  { title: "Configure campaign", body: "Website, budget, objective." },
  { title: "AI builds it", body: "Audiences, copy, structure." },
  { title: "Launch", body: "One click and you're live." },
  { title: "Receive leads", body: "In-app + WhatsApp alerts." },
];

const features = [
  { icon: Megaphone, title: "TikTok Ads Management", body: "Create, monitor and control campaigns natively.", items: ["Create campaigns", "Manage in bulk", "Budget control", "Real-time monitoring"] },
  { icon: Bot, title: "AI Campaign Builder", body: "Skip the guesswork with AI-generated assets.", items: ["AI audience suggestions", "AI ad copy", "AI campaign setup", "AI recommendations"] },
  { icon: Inbox, title: "Lead Generation", body: "Every form submission, instantly delivered.", items: ["Lead collection", "Lead notifications", "CRM integration", "WhatsApp alerts"] },
  { icon: LineChart, title: "Analytics", body: "All the metrics that matter, no spreadsheets.", items: ["Spend & CTR", "CPL & ROAS", "Conversion tracking", "Daily reports"] },
];

const audiences = [
  { title: "Service Businesses", body: "Generate qualified leads for trades & local services.", tags: ["Plumbing", "Construction", "Cleaning"] },
  { title: "eCommerce", body: "Drive sales for online stores with ROAS-focused campaigns.", tags: ["Online Stores", "Fashion", "Beauty"] },
  { title: "Local Businesses", body: "Fill your tables, chairs and bookings with local reach.", tags: ["Restaurants", "Clinics", "Salons"] },
];

const plans = [
  { name: "Starter", price: "€99", items: ["1 ad account", "Up to €2k/mo ad spend", "AI campaign builder", "Email support"] },
  { name: "Growth", price: "€199", featured: true, items: ["3 ad accounts", "Up to €10k/mo ad spend", "WhatsApp AI assistant", "Priority support"] },
  { name: "Pro", price: "€399", items: ["Unlimited ad accounts", "Unlimited spend", "Dedicated success manager", "Custom integrations"] },
];
  );
}
