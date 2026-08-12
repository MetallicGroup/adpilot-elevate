import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { Rocket, CreditCard, ShieldCheck, Megaphone, Inbox, MessageCircle, Settings, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/help-center")({
  head: () => ({ meta: [
    { title: "Centru de ajutor — AdPilot" },
    { name: "description", content: "Ghiduri, pași și răspunsuri care te ajută să folosești AdPilot la maximum." },
    { property: "og:title", content: "Centru de ajutor — AdPilot" },
    { property: "og:description", content: "Ghiduri, pași și răspunsuri care te ajută să folosești AdPilot la maximum." },
    { property: "og:url", content: "https://adpilot.ro/help-center" },
  ], links: [{ rel: "canonical", href: "https://adpilot.ro/help-center" }] }),
  component: HelpCenter,
});

const categories = [
  { icon: Rocket, title: "Primii pași", body: "Creează cont, conectează Facebook și lansează prima campanie." },
  { icon: Megaphone, title: "Campanii", body: "Creare, editare, pauză și optimizare de campanii." },
  { icon: Inbox, title: "Clienți potențiali & CRM", body: "Cum primești clienți, cum îi exporți, cum conectezi un CRM." },
  { icon: MessageCircle, title: "Asistent WhatsApp", body: "Configurare WhatsApp și folosirea comenzilor AI." },
  { icon: CreditCard, title: "Facturare", body: "Abonamente, facturi, schimbare plan, rambursări." },
  { icon: ShieldCheck, title: "Securitate & Confidențialitate", body: "OAuth, GDPR, cereri de ștergere a datelor." },
  { icon: Settings, title: "Setări cont", body: "Profil, membri echipă, preferințe notificări." },
  { icon: HelpCircle, title: "Rezolvare probleme", body: "Erori frecvente și cum se rezolvă." },
];

function HelpCenter() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="Centru de ajutor" title="Cu ce te putem ajuta?" subtitle="Caută ghiduri pe categorii sau scrie-ne la support@adpilot.ro — răspundem într-o zi lucrătoare." />
      <section className="px-6 pb-12 max-w-5xl mx-auto w-full">
        <h2 className="sr-only">Categorii de ajutor</h2>
        <div className="grid gap-4 md:grid-cols-2">
        {categories.map((c) => (
          <div key={c.title} className="card-floating p-6 flex items-start gap-4">
            <c.icon className="w-5 h-5 text-facebook shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
            </div>
          </div>
        ))}
        </div>
      </section>
      <section className="px-6 pb-24 max-w-3xl mx-auto w-full text-center">
        <div className="card-floating-lg p-8">
          <h2 className="font-semibold text-lg">Ai nevoie de ajutor?</h2>
          <p className="mt-2 text-sm text-muted-foreground">Echipa noastră e la un email distanță.</p>
          <a href="mailto:support@adpilot.ro" className="press mt-6 inline-flex items-center px-6 py-3 rounded-lg bg-foreground text-background text-sm font-medium">
            Email support@adpilot.ro
          </a>
          <p className="mt-4 text-xs text-muted-foreground">Looking for product docs? <Link to="/documentation" className="underline">Visit the documentation</Link>.</p>
        </div>
      </section>
    </MarketingLayout>
  );
}