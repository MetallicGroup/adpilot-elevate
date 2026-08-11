import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { resendConfirmationEmail, translateAuthError } from "@/lib/auth";

type Search = { email?: string };

export const Route = createFileRoute("/auth/confirm-email")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    email: typeof s.email === "string" ? s.email : undefined,
  }),
  component: ConfirmEmailPage,
  head: () => ({ meta: [{ title: "Confirmă emailul — AdPilot" }] }),
});

const RESEND_COOLDOWN = 60;

function ConfirmEmailPage() {
  const navigate = useNavigate();
  const { email } = Route.useSearch();
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!email) navigate({ to: "/auth", replace: true });
  }, [email, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    if (!email || sending || cooldown > 0) return;
    setSending(true);
    try {
      await resendConfirmationEmail(email);
      toast.success("Am retrimis emailul de confirmare.");
      setCooldown(RESEND_COOLDOWN);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Nu am putut retrimite emailul.";
      toast.error(translateAuthError(msg));
    } finally {
      setSending(false);
    }
  }

  const provider = email?.split("@")[1]?.toLowerCase();
  const inboxLink = mailProviderUrl(provider);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 pt-6">
        <Link
          to="/auth"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Înapoi
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm text-center"
        >
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MailCheck className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight mt-6">
            Confirmă-ți emailul
          </h1>
          <p className="text-muted-foreground text-sm mt-3 leading-relaxed">
            Am trimis un link de confirmare la{" "}
            <span className="text-foreground font-medium">{email}</span>. Deschide emailul și apasă
            pe buton ca să-ți activezi contul.
          </p>

          {inboxLink && (
            <a
              href={inboxLink}
              target="_blank"
              rel="noreferrer"
              className="press mt-8 w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Mail className="w-4 h-4" /> Deschide inbox
            </a>
          )}

          <button
            type="button"
            onClick={resend}
            disabled={sending || cooldown > 0}
            className="press mt-3 w-full py-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sending && <Loader2 className="w-4 h-4 animate-spin" />}
            {cooldown > 0
              ? `Retrimite în ${cooldown}s`
              : sending
                ? "Se trimite…"
                : "Retrimite emailul"}
          </button>

          <p className="mt-6 text-xs text-muted-foreground leading-relaxed">
            Nu vezi emailul? Verifică folderul de Spam sau{" "}
            <Link
              to="/auth"
              search={{ mode: "signup" as const }}
              className="text-foreground hover:underline"
            >
              schimbă adresa
            </Link>
            .
          </p>

          <p className="mt-8 text-xs text-muted-foreground">
            Ai confirmat deja?{" "}
            <Link
              to="/auth"
              search={{ mode: "signin" as const, email }}
              className="text-foreground font-medium hover:underline"
            >
              Loghează-te
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}

function mailProviderUrl(host?: string) {
  if (!host) return null;
  if (host.includes("gmail") || host.includes("googlemail")) return "https://mail.google.com";
  if (host.includes("outlook") || host.includes("hotmail") || host.includes("live"))
    return "https://outlook.live.com/mail/";
  if (host.includes("yahoo")) return "https://mail.yahoo.com";
  if (host.includes("icloud")) return "https://www.icloud.com/mail";
  if (host.includes("proton")) return "https://mail.proton.me";
  return null;
}
