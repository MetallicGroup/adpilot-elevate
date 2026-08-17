import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostAuthPath } from "@/lib/post-auth";
import { translateAuthError } from "@/lib/auth";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallbackPage,
  head: () => ({ meta: [{ title: "Signing in — AdPilot" }] }),
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "",
      );
      const code = params.get("code");
      const hashSession = getHashSessionParams(hashParams);
      const type = params.get("type") ?? hashParams.get("type");
      const authError =
        params.get("error_description") ??
        params.get("error") ??
        hashParams.get("error_description") ??
        hashParams.get("error");

      if (authError) {
        toast.error(translateAuthError(decodeURIComponent(authError)));
        if (!cancelled) navigate({ to: "/auth", replace: true });
        return;
      }

      let session: Session | null = null;

      if (hashSession) {
        const { data, error } = await supabase.auth.setSession(hashSession);
        clearAuthHash();
        if (error) {
          toast.error(translateAuthError(error.message));
          if (!cancelled) navigate({ to: "/auth", replace: true });
          return;
        }
        session = data.session;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          toast.error(translateAuthError(error.message));
          if (!cancelled) navigate({ to: "/auth", replace: true });
          return;
        }
      }

      session = session ?? (await waitForSessionHydration());

      if (session) {
        // Securitate: scoatem code/token din URL (search + hash) ACUM — parametrii au
        // fost deja citiți mai sus. Astfel niciun analytics (ex. pixelul TikTok, care
        // atașează location.href la evenimente) nu poate trimite tokenul la un terț.
        window.history.replaceState(
          window.history.state,
          document.title,
          window.location.pathname,
        );

        // Ruteză după tipul de link din email.
        if (type === "recovery") {
          if (!cancelled) navigate({ to: "/reset-password", replace: true });
          return;
        }
        if (type === "signup" || type === "email_change" || type === "email") {
          if (!cancelled) navigate({ to: "/auth/verified", replace: true });
          return;
        }

        // OAuth (Google) — dacă e primul sign-in, arătăm ecranul de bun venit.
        const user = session.user;
        const created = new Date(user.created_at).getTime();
        const lastSignIn = user.last_sign_in_at
          ? new Date(user.last_sign_in_at).getTime()
          : created;
        const isFirstSignIn = Math.abs(lastSignIn - created) < 15_000;
        const isOAuth = (user.app_metadata?.provider ?? "email") !== "email";

        if (isOAuth && isFirstSignIn) {
          if (!cancelled) navigate({ to: "/auth/welcome", replace: true });
          return;
        }

        const dest = await resolvePostAuthPath();
        if (!cancelled) navigate({ to: dest, replace: true });
        return;
      }

      toast.error("Nu am putut finaliza autentificarea.");
      if (!cancelled) navigate({ to: "/auth", replace: true });
    }

    finish();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 ">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Te conectăm la cont...</p>
    </div>
  );
}

function getHashSessionParams(hashParams: URLSearchParams) {
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  return { access_token: accessToken, refresh_token: refreshToken };
}

function clearAuthHash() {
  window.history.replaceState(
    window.history.state,
    document.title,
    `${window.location.pathname}${window.location.search}`,
  );
}

async function waitForSessionHydration(): Promise<Session | null> {
  const initial = await supabase.auth.getSession();
  if (initial.data.session) return initial.data.session;

  return new Promise<Session | null>((resolve) => {
    let subscription: { unsubscribe: () => void } | undefined;
    let settled = false;
    const finish = (session: Session | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      subscription?.unsubscribe();
      resolve(session);
    };

    const timeout = window.setTimeout(() => {
      finish(null);
    }, 5000);

    subscription = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" || !session) return;
      finish(session);
    }).data.subscription;
  });
}
