import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { Band, CardGrid } from "@/components/v2/kit";
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
      <Band tone="light">
        <h2 className="sr-only">Categorii de ajutor</h2>
        <CardGrid items={categories.map((c) => ({ title: c.title, body: c.body }))} />
        <div className="note" data-r>
          <h3 className="d3">Ai nevoie de ajutor?</h3>
          <p>
            Scrie-ne la <a href="mailto:support@adpilot.ro">support@adpilot.ro</a>. Pentru ghiduri de produs, vezi{" "}
            <Link to="/documentation">documentația</Link>.
          </p>
        </div>
      </Band>
    </MarketingLayout>
  );
}
