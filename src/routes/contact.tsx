import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { Band } from "@/components/v2/kit";
import { toast } from "sonner";
import { Mail, Building2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { submitContactMessage } from "@/lib/contact.functions";

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
  const [sending, setSending] = useState(false);
  const send = useServerFn(submitContactMessage);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setSending(true);
    try {
      await send({
        data: {
          name: String(fd.get("name") ?? ""),
          email: String(fd.get("email") ?? ""),
          message: String(fd.get("message") ?? ""),
        },
      });
      setSent(true);
      form.reset();
      toast.success("Mesaj trimis — revenim curând.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nu am putut trimite mesajul.");
    } finally {
      setSending(false);
    }
  }

  return (
    <MarketingLayout>
      <PageHero eyebrow="Contact" title="Hai să vorbim." subtitle="Vânzări, suport, parteneriate sau presă. Răspundem de obicei într-o zi lucrătoare." />
      <Band tone="light">
        <div className="contact2">
          <div className="rows" style={{ marginTop: 0 }}>
            <div>
              <span className="k">EMAIL</span>
              <p>support@adpilot.ro</p>
            </div>
            <div>
              <span className="k">RĂSPUNS</span>
              <p>De obicei într-o zi lucrătoare.</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="form2">
            <label className="fld" htmlFor="c-name">
              Nume
              <input id="c-name" name="name" required minLength={2} autoComplete="name" />
            </label>
            <label className="fld" htmlFor="c-email">
              Email
              <input id="c-email" name="email" required type="email" autoComplete="email" />
            </label>
            <label className="fld" htmlFor="c-message">
              Mesaj
              <textarea id="c-message" name="message" required minLength={5} rows={5} />
            </label>
            <button disabled={sending} className="btn btn-k" style={{ justifyContent: "center" }}>
              {sending ? "Se trimite…" : sent ? "Trimite alt mesaj" : "Trimite mesaj"}
            </button>
          </form>
        </div>
      </Band>
    </MarketingLayout>
  );
}
