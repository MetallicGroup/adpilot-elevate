import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { toast } from "sonner";
import { Mail, Building2 } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [
    { title: "Contact — AdPilot" },
    { name: "description", content: "Contactează echipa AdPilot. Vânzări, suport, parteneriate și presă." },
    { property: "og:title", content: "Contact — AdPilot" },
    { property: "og:description", content: "Răspundem în maxim o zi lucrătoare." },
    { property: "og:url", content: "https://adpilot.ro/contact" },
  ], links: [{ rel: "canonical", href: "https://adpilot.ro/contact" }] }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);
  return (
    <MarketingLayout>
      <PageHero eyebrow="Contact" title="Hai să vorbim." subtitle="Vânzări, suport, parteneriate sau presă — răspundem de obicei într-o zi lucrătoare." />
      <section className="px-6 pb-20 max-w-5xl mx-auto w-full grid gap-8 md:grid-cols-2">
        <div className="space-y-5">
          <ContactItem icon={Mail} title="Email" value="support@adpilot.ro" />
          <ContactItem icon={Building2} title="Companie" value="AdPilot SRL" />
          <div className="card-floating p-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Timp de răspuns</p>
            <p className="mt-1 text-sm">Răspundem de obicei într-o zi lucrătoare.</p>
          </div>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); setSent(true); toast.success("Mesaj trimis — revenim curând."); }}
          className="card-floating-lg p-7 space-y-4"
        >
          <Field label="Nume"><input required className="w-full h-11 px-3 rounded-lg border border-border bg-background" /></Field>
          <Field label="Email"><input required type="email" className="w-full h-11 px-3 rounded-lg border border-border bg-background" /></Field>
          <Field label="Mesaj"><textarea required rows={5} className="w-full p-3 rounded-lg border border-border bg-background" /></Field>
          <button disabled={sent} className="press w-full h-11 rounded-lg bg-foreground text-background font-medium">
            {sent ? "Trimis" : "Trimite mesaj"}
          </button>
        </form>
      </section>
    </MarketingLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
function ContactItem({ icon: Icon, title, value }: { icon: any; title: string; value: string }) {
  return (
    <div className="card-floating p-6 flex items-start gap-4">
      <Icon className="w-5 h-5 text-facebook mt-0.5" />
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{title}</p>
        <p className="mt-1 font-medium">{value}</p>
      </div>
    </div>
  );
}