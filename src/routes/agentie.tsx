import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Reveal } from "@/components/wow/Reveal";
import { Check, Link2, Users, LayoutGrid, ArrowRight, Building2 } from "lucide-react";
import { markAgencyIntent } from "@/lib/post-auth";

export const Route = createFileRoute("/agentie")({
  head: () => ({
    meta: [
      { title: "AdPilot pentru agenții" },
      { name: "robots", content: "noindex, nofollow" },
      {
        name: "description",
        content:
          "Gestionează reclamele tuturor clienților tăi dintr-un singur loc. Clienții se conectează singuri printr-un link.",
      },
    ],
  }),
  component: AgencyLanding,
});

const STEPS = [
  {
    icon: Building2,
    n: "01",
    t: "Creezi contul de agenție",
    d: "Primești un link unic de invitație pentru clienții tăi. Durează un minut.",
  },
  {
    icon: Link2,
    n: "02",
    t: "Trimiți linkul clienților",
    d: "Ei se conectează cu Facebook în 60 de secunde — pagina și contul de reclame ajung la tine instant.",
  },
  {
    icon: LayoutGrid,
    n: "03",
    t: "Gestionezi tot dintr-un loc",
    d: "Campaniile, lead-urile și rezultatele tuturor clienților, în dashboard-ul tău de agenție.",
  },
];

const FAQ = [
  {
    q: "Cui aparțin conturile?",
    a: "Clientului. Tu primești doar acces de gestionare a paginii și contului de reclame — nu deții conturile lui.",
  },
  {
    q: "Cine plătește?",
    a: "Agenția. Tu ai un singur abonament de agenție care acoperă sloturile de client.",
  },
  {
    q: "Cum se deconectează un client?",
    a: "Oricând, din ambele părți: tu îl deconectezi din dashboard, iar clientul poate revoca accesul oricând din setările lui de Facebook.",
  },
];

function AgencyLanding() {
  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="relative px-6 pt-20 pb-16 max-w-5xl mx-auto w-full text-center overflow-hidden">
        <div
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[560px] w-[820px] -translate-x-1/2 rounded-full opacity-60"
          style={{ background: "var(--gradient-glow, radial-gradient(circle, oklch(0.55 0.24 297 / 0.18), transparent 70%))" }}
        />
        <Reveal>
          <p className="eyebrow inline-flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" /> AdPilot pentru agenții
          </p>
        </Reveal>
        <Reveal>
          <h1 className="mt-6 font-serif text-4xl md:text-6xl font-semibold leading-[1.04] tracking-tight">
            Gestionează reclamele tuturor clienților tăi.{" "}
            <span className="gradient-text">Dintr-un singur loc.</span>
          </h1>
        </Reveal>
        <Reveal>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Clienții se conectează singuri printr-un link. Agenția primește acces instant la paginile
            și conturile lor de reclame — fără emailuri, fără parole schimbate între voi.
          </p>
        </Reveal>
        <Reveal>
          <div className="mt-9 flex justify-center">
            <Link
              to="/auth"
              search={{ mode: "signup", redirect: "/agency/setup" }}
              onClick={markAgencyIntent}
              className="press btn-primary inline-flex items-center gap-2 px-7 py-4 rounded-xl font-semibold"
            >
              Creează cont de agenție <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* CUM FUNCȚIONEAZĂ */}
      <section className="px-6 py-16 max-w-6xl mx-auto w-full">
        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map((s) => (
            <Reveal key={s.n}>
              <div className="card-floating h-full rounded-2xl border border-border p-7">
                <div className="flex items-center justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <s.icon className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-mono text-muted-foreground">{s.n}</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PRICING — DOAR AICI */}
      <section className="px-6 py-16 max-w-4xl mx-auto w-full">
        <Reveal>
          <div className="text-center mb-10">
            <h2 className="font-serif text-3xl md:text-4xl font-semibold tracking-tight">
              Un singur abonament pentru toată agenția
            </h2>
            <p className="mt-3 text-muted-foreground">Fără costuri ascunse. Adaugi clienți când crești.</p>
          </div>
        </Reveal>
        <Reveal>
          <div className="card-floating rounded-3xl border border-primary/25 p-8 md:p-10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-sm text-primary font-medium">
                  <Users className="w-4 h-4" /> Cont Agenție
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-serif text-5xl font-bold tracking-tight">995 lei</span>
                  <span className="text-muted-foreground">/ lună</span>
                </div>
                <p className="mt-1 text-muted-foreground">Include 2 afaceri (conturi client).</p>
              </div>
              <Link
                to="/auth"
                search={{ mode: "signup", redirect: "/agency/setup" }}
              onClick={markAgencyIntent}
                className="press btn-primary inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl font-semibold"
              >
                Creează cont de agenție
              </Link>
            </div>

            <div className="mt-8 grid sm:grid-cols-2 gap-3 text-sm">
              {[
                "2 afaceri incluse",
                "Link unic de conectare pentru clienți",
                "Dashboard cu toți clienții",
                "Lead-uri și statistici live per client",
              ].map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" /> {f}
                </div>
              ))}
            </div>

            <div className="mt-8 border-t border-border pt-6 grid sm:grid-cols-2 gap-4">
              <div className="rounded-xl bg-secondary/40 p-4">
                <div className="font-semibold">+249 lei / lună</div>
                <div className="text-sm text-muted-foreground">per afacere suplimentară (facturare automată)</div>
              </div>
              <div className="rounded-xl bg-secondary/40 p-4">
                <div className="font-semibold">+500 lei / lună</div>
                <div className="text-sm text-muted-foreground">
                  White-label complet — logo-ul agenției pe pagina de conectare, fără branding AdPilot
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="px-6 py-16 max-w-3xl mx-auto w-full">
        <h2 className="font-serif text-2xl md:text-3xl font-semibold text-center mb-8">Întrebări frecvente</h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <Reveal key={f.q}>
              <div className="rounded-2xl border border-border p-6">
                <h3 className="font-semibold">{f.q}</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">{f.a}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link
            to="/auth"
            search={{ mode: "signup", redirect: "/agency/setup" }}
              onClick={markAgencyIntent}
            className="press btn-primary inline-flex items-center gap-2 px-7 py-4 rounded-xl font-semibold"
          >
            Creează cont de agenție <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
