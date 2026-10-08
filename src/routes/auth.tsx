import { createFileRoute, Link, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { signInWithProvider, translateAuthError, waitForClientSession } from "@/lib/auth";
import { getMetaPublicConfig, completeFacebookSignup } from "@/lib/meta-oauth.functions";
import { postAuthDest, markAgencyIntent } from "@/lib/post-auth";
import { tkClickButton, tkCompleteRegistration } from "@/lib/tiktok-pixel";
import { fbLead, fbCompleteRegistration } from "@/lib/meta-pixel";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Ribbon } from "@/components/v2/Ribbon";

type AuthSearch = {
  email?: string;
  mode?: "signin" | "signup";
  goal?: string;
  redirect?: string;
  fb?: string;
  type?: "business" | "agency";
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
    if (s.type === "agency" || s.type === "business") out.type = s.type;
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
  const [accountType] = useState<"business" | "agency">(
    search.type === "agency" ? "agency" : "business",
  );
  const [loading, setLoading] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
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
    const dest = await postAuthDest();
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
        // Alegere Afacere/Agenție → agenția merge pe fluxul de agenție (persistă și
        // prin confirmarea pe email).
        if (accountType === "agency") markAgencyIntent();
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
          // Fără răspuns (anulare SAU JSSDK dezactivat în app) → NU lăsăm butonul
          // mort: cădem pe redirect-ul server (config_id web), care merge oricum.
          window.location.href = "/api/meta/signup/start";
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

  const switchMode = (next: "signin" | "signup") => {
    setMode(next);
    setEmailOpen(false);
  };

  const socialButtons = (
    <>
      <button type="button" className="sso fb" onClick={facebookSignup} disabled={loading}>
        {loading ? (
          <Loader2 className="spin" width={18} height={18} />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
            <path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.700c0-.9.300-1.600 1.600-1.600h1.700V4.200c-.300 0-1.300-.1-2.500-.1-2.500 0-4.100 1.500-4.100 4.200v2.500H7.400V14h2.800v8h3.300z" />
          </svg>
        )}
        Continuă cu Facebook
      </button>
      <button type="button" className="sso gg" onClick={() => oauth("google")} disabled={loading}>
        Continuă cu Google
      </button>
    </>
  );

  return (
    <div className="v2">
      <div className="auth">
        <aside className="side">
          <Ribbon />
          <div className="grain" />
          <Link to="/" className="brand">
            <span className="logo" />
            AdPilot
          </Link>
          <div>
            <p className="eyebrow" style={{ color: "#c9c6dc" }}>
              7 zile gratuite · fără card
            </p>
            <h2 style={{ marginTop: 16 }}>
              Tu conduci afacerea.
              <br />
              <span className="gtext">AdPilot conduce reclamele.</span>
            </h2>
          </div>
          <div className="ticker">
            <div className="float">
              <div className="row">
                <span className="av">AP</span>
                <div>
                  <b>AdPilot</b>
                  <div className="l" style={{ margin: 0 }}>
                    Campania ta e live pe Facebook și Instagram.
                  </div>
                </div>
              </div>
            </div>
            <div className="float" style={{ animationDelay: ".25s", marginLeft: 36 }}>
              <div className="live">LEAD NOU</div>
              <div style={{ marginTop: 6 }}>
                <b>Mihai</b> a cerut detalii acum 12 secunde
              </div>
            </div>
          </div>
        </aside>

        <form className="form" onSubmit={submit}>
          <Link to="/" className="brand amob">
            <span className="logo" />
            AdPilot
          </Link>
          <div className="amode">
            <button type="button" aria-pressed={isSignup} onClick={() => switchMode("signup")}>
              Cont nou
            </button>
            <button type="button" aria-pressed={!isSignup} onClick={() => switchMode("signin")}>
              Intră în cont
            </button>
          </div>
          <h2 className="d2">{isSignup ? "Creează cont" : "Bine ai revenit"}</h2>
          <p style={{ margin: "-6px 0 2px", color: "var(--mut)" }}>
            {isSignup
              ? accountType === "agency"
                ? "Cont de agenție. Clienții tăi se conectează printr-un link."
                : "7 zile gratuite, fără card."
              : "Intră în contul tău AdPilot."}
          </p>

          {isSignup && emailOpen ? (
            <div className="astack" key="email">
              <button type="button" className="aback" onClick={() => setEmailOpen(false)}>
                ← Înapoi
              </button>
              <label className="fld" htmlFor="name">
                Nume complet
                <input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} placeholder="Andrei Popescu" autoComplete="name" />
              </label>
              <label className="fld" htmlFor="phone">
                Număr de telefon
                <input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={20} placeholder="07xx xxx xxx" />
              </label>
              <label className="fld" htmlFor="email">
                Email
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} placeholder="nume@firma.ro" autoComplete="email" />
              </label>
              <label className="fld" htmlFor="password">
                Parolă
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={72} placeholder="Minim 6 caractere" autoComplete="new-password" />
              </label>
              <button type="submit" className="btn btn-k asubmit" disabled={loading}>
                {loading && <Loader2 className="spin" width={18} height={18} />}
                {accountType === "agency" ? "Creează cont de agenție" : "Începe gratuit 7 zile"}
              </button>
            </div>
          ) : (
            <div className="astack" key={mode}>
              {socialButtons}
              {isSignup ? (
                <button type="button" className="sso em" onClick={() => setEmailOpen(true)} disabled={loading}>
                  Continuă cu email
                </button>
              ) : (
                <>
                  <div className="or">sau cu email</div>
                  <label className="fld" htmlFor="email">
                    Email
                    <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} placeholder="nume@firma.ro" autoComplete="email" />
                  </label>
                  <label className="fld" htmlFor="password">
                    Parolă
                    <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={72} placeholder="Parola ta" autoComplete="current-password" />
                  </label>
                  <button type="submit" className="btn btn-k asubmit" disabled={loading}>
                    {loading && <Loader2 className="spin" width={18} height={18} />}
                    Intră în cont
                  </button>
                  <Link to="/forgot-password" search={email ? { email } : undefined} className="aback" style={{ alignSelf: "center" }}>
                    Am uitat parola
                  </Link>
                </>
              )}
            </div>
          )}

          {isSignup && (
            <p className="fine">
              Continuând, accepți <Link to="/terms-of-service" className="alink">Termenii</Link> și{" "}
              <Link to="/privacy-policy" className="alink">Politica de confidențialitate</Link>.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
