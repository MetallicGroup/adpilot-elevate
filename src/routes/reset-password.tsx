import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Resetare parolă — AdPilot" }] }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase auto-processes the recovery token from the URL hash and
    // fires a PASSWORD_RECOVERY auth event, leaving a temporary session.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Parola trebuie să aibă minim 6 caractere");
      return;
    }
    if (password !== confirm) {
      toast.error("Parolele nu se potrivesc");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Parola a fost schimbată");
      navigate({ to: "/onboarding", replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Eroare la schimbarea parolei");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 pt-6">
        <Link to="/auth" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
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
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-center">
            Resetare parolă
          </h1>
          <p className="text-center text-muted-foreground text-sm mt-2">
            {ready
              ? "Alege o parolă nouă pentru contul tău."
              : "Verificăm link-ul de resetare..."}
          </p>

          {ready && (
            <form onSubmit={submit} className="space-y-3 mt-8">
              <input
                type="password"
                placeholder="Parolă nouă"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="password"
                placeholder="Confirmă parola"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={loading}
                className="press w-full py-3 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Schimbă parola
              </button>
            </form>
          )}
        </motion.div>
      </main>
    </div>
  );
}