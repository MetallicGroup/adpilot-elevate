import { createFileRoute, Link, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { signInWithProvider, translateAuthError, waitForClientSession } from "@/lib/auth";
import { getMetaPublicConfig, completeFacebookSignup } from "@/lib/meta-oauth.functions";
import { resolvePostAuthPath } from "@/lib/post-auth";
import { tkClickButton, tkCompleteRegistration } from "@/lib/tiktok-pixel";
import { fbLead, fbCompleteRegistration } from "@/lib/meta-pixel";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MessageCircle, Sparkles } from "lucide-react";

type AuthSearch = {
  email?: string;
  mode?: "signin" | "signup";
  goal?: string;
  redirect?: string;
  fb?: string;
};

const FB_NOTICE: Record<string, string> = {
  noemail:
    "Nu am primit adresa de email de la Facebook. Bifează „email” în fereastra Facebook sau creează cont cu email/Google mai jos.",
  denied: "Ai anulat conectarea cu Facebook. Poți încerca din nou sau folosi email/Google.",
  create_failed: "Nu am putut crea contul din Facebook. Încearcă din nou sau folosește email/Google.",
  session_failed: "Contul e creat, dar n-am putut porni sesiunea. Loghează-te mai jos.",
  bad_token: "Conectarea cu Facebook n-a putut fi validată. Încearcă din nou.",
  bad_state: "Sesiunea de conectare a expirat. Încearcă din nou.",
  failed: "Ceva n-a mers la conectarea cu Facebook. Încearcă din nou.",
};

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  validateSearch: (s: Record<string, unknown>): AuthSearch => {
    const out: AuthSearch = {};
    if (typeof s.email === "string") out.email = s.email;
    if (s.mode === "signin" || s.mode === "signup") out.mode = s.mode;
    if (typeof s.goal === "string") out.goal = s.goal;
    // Doar căi interne — niciodată un URL absolut (evită open-redirect).
    if (typeof s.redirect === "string" && s.redirect.startsWith("/") && !s.redirect.startsWith("//")) {
      out.redirect = s.redirect;
    }
    if (typeof s.fb === "string") out.fb = s.fb;
    return out;
  },
  head: () => ({ meta: [{ title: "Autentificare — AdPilot" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [fbReady, setFbReady] = useState(false);
  const [fbCfg, setFbCfg] = useState<{
    appId: string;
    apiVersion: string;
    scopes: string;
    configId: string | null;
  } | null>(null);
  const getFbCfg = useServerFn(getMetaPublicConfig);
  const completeFb = useServerFn(completeFacebookSignup);

  // `auth.tsx` e ruta părinte pentru /auth/confirm-email, /auth/callback etc.
  // Fără Outlet, paginile copil nu se randau (se vedea form-ul de signup la URL-ul
  // lor). Dacă e activă o rută copil, randăm Outlet-ul; altfel form-ul de auth.
  const childActive = useRouterState({
    select: (s) => s.matches[s.matches.length - 1]?.routeId !== "/auth",
  });

  // Persist the objective picked on the homepage so the wizard can preselect it.
  useEffect(() => {
    if (!search.goal) return;
    try { window.localStorage.setItem("adpilot:goal", search.goal); } catch { /* ignore */ }
  }, [search.goal]);

  // Feedback după o revenire din signup-ul cu Facebook care nu a reușit.
  useEffect(() => {
    if (!search.fb) return;
    toast.error(FB_NOTICE[search.fb] ?? FB_NOTICE.failed);
  }, [search.fb]);

  // Încarcă SDK-ul JS de Facebook. Pe mobil, dialogul poate sări în aplicația
  // Facebook (userul e deja logat acolo) → mult mai puțină frecare. Dacă SDK-ul
  // nu se încarcă, butonul cade automat pe redirect-ul server clasic.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg = await getFbCfg();
        if (!mounted) return;
        setFbCfg(cfg);
        const w = window as any;
        if (w.FB) {
          setFbReady(true);
          return;
        }
        w.fbAsyncInit = function () {
          try {
            w.FB.init({ appId: cfg.appId, cookie: true, xfbml: false, version: cfg.apiVersion });
            if (mounted) setFbReady(true);
          } catch {
            /* rămâne fallback pe redirect */
          }
        };
        if (!document.getElementById("facebook-jssdk")) {
          const s = document.createElement("script");
          s.id = "facebook-jssdk";
          s.src = "https://connect.facebook.net/en_US/sdk.js";
          s.async = true;
          s.defer = true;
          s.crossOrigin = "anonymous";
          document.body.appendChild(s);
        }
      } catch {
        /* fără config → fallback pe redirect */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled || !data.session) return;
      await goPostAuth();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function goPostAuth() {
    await waitForClientSession();
    // Onorează redirect-ul (ex. planul ales din /pricing) înainte de rutarea implicită.
    if (search.redirect) {
      const url = new URL(search.redirect, window.location.origin);
      const sp: Record<string, string> = {};
      url.searchParams.forEach((v, k) => (sp[k] = v));
      navigate({ to: url.pathname, search: sp as never, replace: true });
      return;
    }
    const dest = await resolvePostAuthPath();
    navigate({ to: dest, replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const phoneDigits = phone.replace(/\D/g, "");
        if (phoneDigits.length < 10) {
          toast.error("Introdu un număr de telefon valid (ex. 07xx xxx xxx).");
          return;
        }
        tkClickButton("signup-submit");
        fbLead("signup");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { full_name: name, phone: phone.trim() },
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

        // TikTok: CompleteRegistration EXACT la crearea contului (click pe Sign up),
        // NU la confirmarea emailului. event_id = reg_<userId> → dedup cu server-side.
        if (data.user) {
          void tkCompleteRegistration({ userId: data.user.id, email: data.user.email ?? email });
          fbCompleteRegistration();
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

  function facebookSignup() {
    setLoading(true);
    try { tkClickButton("auth-facebook"); } catch { /* ignore */ }
    const w = window as any;
    // Cale rapidă: SDK-ul JS → pe mobil poate deschide aplicația Facebook.
    if (fbReady && w.FB && fbCfg) {
      // Facebook Login for Business (config_id) întoarce un `code`; login clasic
      // (scope) întoarce un `accessToken`. Suportăm ambele.
      const opts = fbCfg.configId
        ? { config_id: fbCfg.configId, response_type: "code", override_default_response_type: true }
        : { scope: fbCfg.scopes, return_scopes: true, auth_type: "rerequest" };
      w.FB.login((response: any) => {
        const auth = response?.authResponse;
        const payload = auth?.code
          ? { code: auth.code as string }
          : auth?.accessToken
            ? { accessToken: auth.accessToken as string }
            : null;
        if (!payload) {
          setLoading(false); // userul a anulat dialogul
          return;
        }
        completeFb({ data: payload })
          .then((res: any) => {
            if (res?.ok && res.redirect) {
              window.location.href = res.redirect; // magic link → sesiune → onboarding
            } else {
              setLoading(false);
              toast.error(FB_NOTICE[res?.reason] ?? FB_NOTICE.failed);
            }
          })
          .catch(() => {
            // Orice eroare de rețea → cădem pe fluxul clasic prin redirect.
            window.location.href = "/api/meta/signup/start";
          });
      }, opts);
      return;
    }
    // Fallback: redirect server clasic (browser).
    window.location.href = "/api/meta/signup/start";
  }

  async function oauth(provider: "google") {
    setLoading(true);
    try {
      // Supabase redirecționează browserul către Google; revenirea (și schimbul
      // de cod) se face pe /auth/callback, care rulează apoi goPostAuth.
      await signInWithProvider(provider);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Autentificarea a eșuat";
      toast.error(translateAuthError(message));
      setLoading(false);
    }
  }

  const isSignup = mode === "signup";

  if (childActive) return <Outlet />;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
      {/* Brand side */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden px-14 py-10 lg:flex"
        style={{
          background:
            "radial-gradient(circle at 25% 35%, oklch(0.55 0.24 297 / 0.22), transparent 28%), radial-gradient(circle at 72% 70%, oklch(0.52 0.2 265 / 0.14), transparent 25%), linear-gradient(145deg, oklch(0.11 0.028 278), oklch(0.088 0.024 278))",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(oklch(1 0 0 / 0.028) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.028) 1px, transparent 1px)",
            backgroundSize: "54px 54px",
            maskImage: "linear-gradient(to bottom, #000, transparent 85%)",
            WebkitMaskImage: "linear-gradient(to bottom, #000, transparent 85%)",
          }}
        />
        <Link to="/" className="relative z-10 flex items-center gap-2.5 font-bold tracking-tight">
          <img src="/adpilot-icon.png" alt="AdPilot" className="h-9 w-9 rounded-xl object-contain" />
          AdPilot
        </Link>

        <div className="relative z-10">
          <span className="eyebrow">
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-success" />
            3 zile gratuit · anulezi oricând
          </span>
          <h1 className="mt-6 max-w-[690px] text-[clamp(40px,4.4vw,72px)] font-extrabold leading-[0.98] tracking-[-0.055em]">
            Tu conduci afacerea.{" "}
            <span className="gradient-text">AdPilot conduce reclamele.</span>
          </h1>
          <p className="mt-6 max-w-[560px] text-base leading-relaxed text-muted-foreground">
            Campanii create de AI, buget optimizat automat și fiecare lead livrat direct pe
            WhatsApp. Fără agenție, fără dashboard-uri complicate.
          </p>

          {/* floating proof cards */}
          <div className="relative mt-12 h-[300px]">
            <div className="wow-float absolute left-[4%] top-2 w-[340px] rotate-[-4deg] rounded-[22px] border border-primary/25 bg-card/80 p-0 shadow-2xl backdrop-blur-md">
              <div className="flex h-11 items-center border-b border-white/[0.055] px-3.5 text-[10px] text-muted-foreground">
                Campanie · Reduceri de Primăvară
              </div>
              <div className="p-3.5">
                <div className="my-2.5 h-2 w-[92%] rounded-full" style={{ background: "var(--gradient-primary)" }} />
                <div className="my-2.5 h-2 w-[76%] rounded-full opacity-70" style={{ background: "var(--gradient-primary)" }} />
                <div className="my-2.5 h-2 w-[58%] rounded-full opacity-45" style={{ background: "var(--gradient-primary)" }} />
                <p className="mt-3 text-[11px] text-success">+23% lead-uri față de ieri</p>
              </div>
            </div>
            <div className="wow-float-slow absolute right-[6%] top-[110px] w-[290px] rotate-[6deg] rounded-[22px] border border-primary/25 bg-card/80 p-0 shadow-2xl backdrop-blur-md">
              <div className="flex h-11 items-center gap-2 border-b border-white/[0.055] px-3.5 text-[10px] text-muted-foreground">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp AI
              </div>
              <div className="p-3.5">
                <div className="rounded-[10px] bg-secondary p-2.5 text-[10px]">Câte lead-uri azi?</div>
                <div className="mt-2 ml-8 rounded-[10px] p-2.5 text-[10px] text-white" style={{ background: "oklch(0.45 0.11 165)" }}>
                  47 lead-uri — cost/lead 6,8 lei 🚀
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-[11px] text-muted-foreground">
          Peste 200 de afaceri din România folosesc AdPilot zilnic.
        </p>
      </aside>

      {/* Form side */}
      <main className="relative grid place-items-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[430px]"
        >
          <Link
            to="/"
            className="mb-9 inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Înapoi la site
          </Link>

          <h2 className="text-[34px] font-bold leading-tight tracking-[-0.045em]">
            {isSignup ? "Creează cont" : "Bine ai revenit"}
          </h2>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {isSignup
              ? "3 zile gratuit. Lansează prima campanie în 5 minute."
              : "Intră în contul tău AdPilot."}
          </p>

          <button
            type="button"
            onClick={facebookSignup}
            disabled={loading}
            className="press mt-7 flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] text-[15px] font-semibold text-white shadow-lg transition-opacity hover:opacity-95 disabled:opacity-50"
            style={{ background: "#1877F2" }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
              </svg>
            )}
            Continuă cu Facebook
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Recomandat — conectezi pagina și pornești reclamele în 2 minute.
          </p>

          <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> sau <div className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={() => oauth("google")}
            disabled={loading}
            className="press flex h-12 w-full items-center justify-center gap-2 rounded-[13px] border border-white/[0.08] bg-secondary/50 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
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

          <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> sau <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="grid gap-3.5">
            {isSignup && (
              <div>
                <label className="mb-2 block text-[11px] text-muted-foreground" htmlFor="auth-name">
                  Nume complet
                </label>
                <input
                  id="auth-name"
                  type="text"
                  placeholder="Andrei Popescu"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-[52px] w-full rounded-[13px] border border-white/[0.08] bg-black/25 px-3.5 text-sm outline-none transition focus:border-primary/55 focus:ring-4 focus:ring-primary/10"
                />
              </div>
            )}
            {isSignup && (
              <div>
                <label className="mb-2 block text-[11px] text-muted-foreground" htmlFor="auth-phone">
                  Număr de telefon
                </label>
                <input
                  id="auth-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="07xx xxx xxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="h-[52px] w-full rounded-[13px] border border-white/[0.08] bg-black/25 px-3.5 text-sm outline-none transition focus:border-primary/55 focus:ring-4 focus:ring-primary/10"
                />
              </div>
            )}
            <div>
              <label className="mb-2 block text-[11px] text-muted-foreground" htmlFor="auth-email">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                placeholder="nume@firma.ro"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-[52px] w-full rounded-[13px] border border-white/[0.08] bg-black/25 px-3.5 text-sm outline-none transition focus:border-primary/55 focus:ring-4 focus:ring-primary/10"
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] text-muted-foreground" htmlFor="auth-password">
                Parolă
              </label>
              <input
                id="auth-password"
                type="password"
                placeholder="Minim 6 caractere"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-[52px] w-full rounded-[13px] border border-white/[0.08] bg-black/25 px-3.5 text-sm outline-none transition focus:border-primary/55 focus:ring-4 focus:ring-primary/10"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="press btn-primary shine mt-1 flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] text-sm font-semibold disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSignup ? "Începe cele 3 zile gratuit" : "Intră în cont"}
            </button>
          </form>

          {!isSignup && (
            <div className="mt-3 text-right">
              <Link
                to="/forgot-password"
                search={email ? { email } : undefined}
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Am uitat parola
              </Link>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {isSignup ? "Ai deja cont?" : "Nou pe AdPilot?"}{" "}
            <button
              type="button"
              onClick={() => setMode(isSignup ? "signin" : "signup")}
              className="font-bold text-primary hover:underline"
            >
              {isSignup ? "Autentifică-te" : "Creează cont"}
            </button>
          </p>

          <p className="mt-6 text-center text-[10px] leading-relaxed text-muted-foreground">
            Continuând, accepți{" "}
            <Link to="/terms-of-service" className="underline underline-offset-2">Termenii</Link> și{" "}
            <Link to="/privacy-policy" className="underline underline-offset-2">Politica de confidențialitate</Link>.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
