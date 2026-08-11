import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { sendPasswordReset, translateAuthError } from "@/lib/auth";

type Search = { email?: string };

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    email: typeof s.email === "string" ? s.email : undefined,
  }),
  component: ForgotPasswordPage,
  head: () => ({ meta: [{ title: "Resetare parolă — AdPilot" }] }),
});

function ForgotPasswordPage() {
  const { email: initialEmail } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nu am putut trimite emailul.";
      toast.error(translateAuthError(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 pt-6">
        <Link
          to="/auth"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Înapoi la login
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {sent ? (
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <MailCheck className="w-7 h-7 text-primary" />
              </div>
              <h1 className="font-serif text-3xl font-semibold tracking-tight mt-6">
                Verifică emailul
              </h1>
              <p className="text-muted-foreground text-sm mt-3 leading-relaxed">
                Dacă adresa <span className="text-foreground font-medium">{email}</span> are cont la
                noi, ți-am trimis un link să-ți setezi o parolă nouă.
              </p>
              <button
                onClick={() =>
                  navigate({ to: "/auth", search: { mode: "signin" as const, email } })
                }
                className="press mt-8 w-full py-3 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90"
              >
                Înapoi la login
              </button>
            </div>
          ) : (
            <>
              <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Mail className="w-7 h-7 text-primary" />
              </div>
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-center mt-6">
                Ai uitat parola?
              </h1>
              <p className="text-center text-muted-foreground text-sm mt-2">
                Îți trimitem un link să-ți setezi una nouă.
              </p>
              <form onSubmit={submit} className="space-y-3 mt-8">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="press w-full py-3 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Trimite link de resetare
                </button>
              </form>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
