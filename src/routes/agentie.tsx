import { createFileRoute, Link } from "@tanstack/react-router";
import { Band, Faq, Hero } from "@/components/v2/kit";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
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
  const signup = (tone: "w" | "k") => (
    <Link
      to="/auth"
      search={{ mode: "signup", redirect: "/agency/setup" }}
      onClick={markAgencyIntent}
      className={`btn btn-${tone}`}
    >
      Creează cont de agenție <span className="arr">→</span>
    </Link>
  );

  return (
    <MarketingLayout>
      <Hero
        eyebrow="AdPilot pentru agenții"
        title={
          <>
            Reclamele tuturor clienților tăi. <span className="gtext">Dintr‑un singur loc.</span>
          </>
        }
        sub="Clienții se conectează singuri printr-un link. Agenția primește acces instant la paginile și conturile lor de reclame, fără emailuri și fără parole schimbate între voi."
      >
        <div className="cta">{signup("w")}</div>
      </Hero>

      <Band tone="light">
        <p className="ey" data-r>
          Cum funcționează
        </p>
        <h2 className="d2" data-r style={{ marginTop: 16, maxWidth: "16ch" }}>
          Primul client conectat în 60 de secunde.
        </h2>
        <div className="trio">
          {STEPS.map((st, i) => (
            <div key={st.n} data-r style={{ ["--d" as string]: `${i * 0.08}s` }}>
              <span className="k">PASUL {i + 1}</span>
              <h3>{st.t}</h3>
              <p>{st.d}</p>
            </div>
          ))}
        </div>
      </Band>

      <Band tone="dark">
        <p className="ey" data-r>
          Preț
        </p>
        <h2 className="d2" data-r style={{ marginTop: 16, maxWidth: "17ch" }}>
          Un singur abonament pentru toată agenția.
        </h2>
        <div className="agx" data-r>
          <div className="plan hot">
            <span className="tag">Cont agenție</span>
            <div className="pr">
              995 lei <s style={{ textDecoration: "none" }}>pe lună</s>
            </div>
            <div className="then">Include 2 afaceri (conturi de client).</div>
            <ul>
              <li>Link unic de conectare pentru clienți</li>
              <li>Dashboard cu toți clienții</li>
              <li>Lead-uri și statistici live pentru fiecare client</li>
            </ul>
            {signup("w")}
          </div>
          <div className="rows" style={{ marginTop: 0 }}>
            <div>
              <span className="k">+249 LEI / LUNĂ</span>
              <p>pentru fiecare afacere în plus, facturat automat</p>
            </div>
            <div>
              <span className="k">+500 LEI / LUNĂ</span>
              <p>white-label: logo-ul agenției pe pagina de conectare, fără branding AdPilot</p>
            </div>
          </div>
        </div>
      </Band>

      <Band tone="light">
        <h2 className="d2" data-r>
          Întrebări
        </h2>
        <Faq items={FAQ} />
      </Band>
    </MarketingLayout>
  );
}
