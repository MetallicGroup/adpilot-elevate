import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { toast } from "sonner";
import { Mail, MapPin, Building2 } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [
    { title: "Contact — AdPilot" },
    { name: "description", content: "Get in touch with the AdPilot team. Sales, support, partnerships and press inquiries." },
  ] }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);
  return (
    <MarketingLayout>
      <PageHero eyebrow="Contact" title="Talk to us." subtitle="Sales, support, partnerships or press — we typically respond within one business day." />
      <section className="px-6 pb-20 max-w-5xl mx-auto w-full grid gap-8 md:grid-cols-2">
        <div className="space-y-5">
          <ContactItem icon={Mail} title="Email" value="hello@adpilot.ro" />
          <ContactItem icon={MapPin} title="Address" value="Str. Exemplului 12, Bucharest, Romania" />
          <ContactItem icon={Building2} title="Company" value="AdPilot SRL — Reg. J40/0000/2025" />
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); setSent(true); toast.success("Message sent — we'll be in touch soon."); }}
          className="card-floating-lg p-7 space-y-4"
        >
          <Field label="Name"><input required className="w-full h-11 px-3 rounded-lg border border-border bg-background" /></Field>
          <Field label="Email"><input required type="email" className="w-full h-11 px-3 rounded-lg border border-border bg-background" /></Field>
          <Field label="Message"><textarea required rows={5} className="w-full p-3 rounded-lg border border-border bg-background" /></Field>
          <button disabled={sent} className="press w-full h-11 rounded-lg bg-foreground text-background font-medium">
            {sent ? "Sent" : "Send message"}
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
      <Icon className="w-5 h-5 text-tiktok mt-0.5" />
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{title}</p>
        <p className="mt-1 font-medium">{value}</p>
      </div>
    </div>
  );
}