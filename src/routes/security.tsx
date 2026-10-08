import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { Band, CardGrid } from "@/components/v2/kit";
import { Check, ShieldCheck, Lock, Globe, Users } from "lucide-react";

export const Route = createFileRoute("/security")({
  head: () => ({ meta: [
    { title: "Securitate & Confidențialitate — AdPilot" },
    { name: "description", content: "Autentificare OAuth, conformitate GDPR, stocare criptată și deținere completă a contului de reclame." },
    { property: "og:title", content: "Securitate & Confidențialitate — AdPilot" },
    { property: "og:description", content: "Autentificare OAuth, conformitate GDPR, stocare criptată și deținere completă a contului de reclame." },
    { property: "og:url", content: "https://adpilot.ro/security" },
  ], links: [{ rel: "canonical", href: "https://adpilot.ro/security" }] }),
  component: SecurityPage,
});

const pillars = [
  { icon: ShieldCheck, title: "Autentificare OAuth", body: "Ne conectăm la Meta (Facebook și Instagram) folosind fluxul oficial OAuth 2.0. Nu vedem și nu stocăm niciodată parola ta." },
  { icon: Lock, title: "Stocare criptată", body: "Toate tokenurile de acces și datele personale sunt criptate în repaus cu AES-256." },
  { icon: Globe, title: "Conform GDPR", body: "Construit în UE, AdPilot respectă principiile GDPR: bază legală, minimizarea datelor și dreptul la ștergere." },
  { icon: Users, title: "Tu deții contul de reclame", body: "Contul de Business rămâne mereu pe numele tău. Nu preluăm niciodată conturi sau campanii." },
];

function SecurityPage() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="Securitate & Confidențialitate" title="Datele tale. Contul tău. Controlul tău." subtitle="Securitatea nu e o funcționalitate — e fundația AdPilot. Iată cum îți protejăm contul și datele clienților tăi." />
      <Band tone="light">
        <h2 className="sr-only">Pilonii de securitate AdPilot</h2>
        <CardGrid items={pillars.map((p) => ({ title: p.title, body: p.body }))} />
      </Band>
      <Band tone="dark">
        <h2 className="d2" data-r>
          Promisiunile noastre
        </h2>
        <div className="rows">
          {PROMISES.map((t, i) => (
            <div key={t} data-r>
              <span className="k">0{i + 1}</span>
              <p>{t}</p>
            </div>
          ))}
        </div>
      </Band>
    </MarketingLayout>
  );
}

const PROMISES = [
  "Nu vindem și nu împărtășim niciodată datele tale cu terți.",
  "Nu rulăm campanii fără aprobarea ta explicită.",
  "Poți revoca accesul AdPilot la contul tău oricând.",
  "Poți solicita exportul complet sau ștergerea datelor scriindu-ne la support@adpilot.ro.",
  "Datele personale sunt prelucrate doar așa cum este descris în Politica de confidențialitate.",
];
