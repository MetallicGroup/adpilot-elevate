import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { signInWithProvider, translateAuthError, waitForClientSession } from "@/lib/auth";
import { resolvePostAuthPath } from "@/lib/post-auth";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

type AuthSearch = { email?: string; mode?: "signin" | "signup" };

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  validateSearch: (s: Record<string, unknown>): AuthSearch => {
    const out: AuthSearch = {};
    if (typeof s.email === "string") out.email = s.email;
    if (s.mode === "signin" || s.mode === "signup") out.mode = s.mode;
    return out;
  },
  head: () => ({ meta: [{ title: "Autentificare — AdPilot" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signup");
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (data.session) {
        const dest = await resolvePostAuthPath();
        if (!cancelled) navigate({ to: dest, replace: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function goPostAuth() {
    await waitForClientSession();
    const dest = await resolvePostAuthPath();
    navigate({ to: dest, replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { full_name: name },
          },
        });
        if (error) throw error;

        // Supabase semnalează "email deja folosit" prin identities: []
        // (userul nu este creat, doar returnat).
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          toast.error("Există deja un cont cu acest email. Loghează-te sau resetează parola.");
          setMode("signin");
          return;
        }

        if (!data.session) {
          // Confirmare email obligatorie — trimitem userul la ecranul de confirmare.
          navigate({
            to: "/auth/confirm-email",
            search: { email },
            replace: true,
          });
          return;
        }

        // Auto-confirm activ (dev fallback) — intrăm direct.
        toast.success("Cont creat cu succes!");
        await waitForClientSession();
        await goPostAuth();
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await waitForClientSession();
        toast.success("Bine ai revenit!");
        await goPostAuth();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ceva nu a mers bine";
      toast.error(translateAuthError(message));
    } finally {
      setLoading(false);
    }
  }

  async function oauth(provider: "google") {
    setLoading(true);
    try {
      const result = await signInWithProvider(provider);
      if (result.redirected) return;

      toast.success("Bine ai revenit!");
      await goPostAuth();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Autentificarea a eșuat";
      toast.error(translateAuthError(message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 pt-6">
        <Link
          to="/"
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
          className="w-full max-w-sm"
        >
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-center">
            {mode === "signup" ? "Creează cont" : "Bine ai revenit"}
          </h1>
          <p className="text-center text-muted-foreground text-sm mt-2">
            {mode === "signup"
              ? "Lansează reclame în mai puțin de 5 minute."
              : "Intră în contul tău AdPilot."}
          </p>

          <button
            type="button"
            onClick={() => oauth("google")}
            disabled={loading}
            className="press mt-8 w-full flex items-center justify-center gap-2 py-3 border border-border rounded-xl text-sm font-medium hover:bg-secondary transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.22-4.74 3.22-8.3z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.12A6.6 6.6 0 015.5 12c0-.74.13-1.45.34-2.12V7.04H2.18A11 11 0 001 12c0 1.77.42 3.45 1.18 4.96l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
              />
            </svg>
            Continuă cu Google
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex-1 h-px bg-border" /> sau <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <input
                type="text"
                placeholder="Nume complet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="password"
              placeholder="Parolă"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              {mode === "signup" ? "Creează cont" : "Intră în cont"}
            </button>
          </form>

          {mode === "signin" && (
            <div className="mt-3 text-right">
              <Link
                to="/forgot-password"
                search={email ? { email } : undefined}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
              >
                Am uitat parola
              </Link>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Ai deja cont?" : "Nou pe AdPilot?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="text-foreground font-medium hover:underline"
            >
              {mode === "signup" ? "Autentifică-te" : "Creează cont"}
            </button>
          </p>

          <p className="mt-6 text-center text-[11px] text-muted-foreground leading-relaxed">
            Continuând, accepți Termenii și Politica de confidențialitate.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
