import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { Check, ShieldCheck, Lock, Globe, Users } from "lucide-react";

export const Route = createFileRoute("/security")({
  head: () => ({ meta: [
    { title: "Securitate & Confidențialitate — AdPilot" },
    { name: "description", content: "Autentificare OAuth, conformitate GDPR, stocare criptată și deținere completă a contului de reclame." },
  ] }),
  component: SecurityPage,
});

const pillars = [
  { icon: ShieldCheck, title: "Autentificare OAuth", body: "Ne conectăm la TikTok și Meta folosind fluxul oficial OAuth 2.0. Nu vedem și nu stocăm niciodată parola ta." },
  { icon: Lock, title: "Stocare criptată", body: "Toate tokenurile de acces și datele personale sunt criptate în repaus cu AES-256." },
  { icon: Globe, title: "Conform GDPR", body: "Construit în UE, AdPilot respectă principiile GDPR: bază legală, minimizarea datelor și dreptul la ștergere." },
  { icon: Users, title: "Tu deții contul de reclame", body: "Contul de Business rămâne mereu pe numele tău. Nu preluăm niciodată conturi sau campanii." },
];

function SecurityPage() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="Securitate & Confidențialitate" title="Datele tale. Contul tău. Controlul tău." subtitle="Securitatea nu e o funcționalitate — e fundația AdPilot. Iată cum îți protejăm contul și datele clienților tăi." />
      <section className="px-6 pb-12 max-w-5xl mx-auto w-full grid gap-5 md:grid-cols-2">
        {pillars.map((p) => (
          <div key={p.title} className="card-floating p-7">
            <p.icon className="w-6 h-6 text-facebook" />
            <h3 className="mt-4 font-semibold">{p.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.body}</p>
          </div>
        ))}
      </section>
      <section className="px-6 pb-20 max-w-3xl mx-auto w-full">
        <div className="card-floating-lg p-8">
          <h3 className="font-semibold">Promisiunile noastre</h3>
          <ul className="mt-5 space-y-3">
            {[
              "Nu vindem și nu împărtășim niciodată datele tale cu terți.",
              "Nu rulăm campanii fără aprobarea ta explicită.",
              "Poți revoca accesul AdPilot la contul tău oricând.",
              "Poți solicita exportul complet sau ștergerea datelor scriindu-ne la support@adpilot.ro.",
              "Datele personale sunt prelucrate doar așa cum este descris în Politica de confidențialitate.",
            ].map((i) => (
              <li key={i} className="flex items-start gap-3 text-sm"><Check className="w-4 h-4 text-success mt-0.5 shrink-0" />{i}</li>
            ))}
          </ul>
        </div>
      </section>
    </MarketingLayout>
  );
}