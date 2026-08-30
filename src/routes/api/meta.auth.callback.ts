import { createFileRoute } from "@tanstack/react-router";
import { getCookie, deleteCookie } from "@tanstack/react-start/server";

export const Route = createFileRoute("/api/meta/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        const returnTo = getCookie("meta_oauth_return") ?? "/settings";
        const safeReturn = returnTo === "/onboarding" ? "/onboarding" : "/settings";
        deleteCookie("meta_oauth_return", { path: "/" });
        const back = (q: string) =>
          new Response(null, {
            status: 302,
            headers: { Location: `${safeReturn}?${q}` },
          });
        // Erorile de signup nu au sesiune → le trimitem la pagina de auth, nu în app.
        const toAuth = (q: string) =>
          new Response(null, { status: 302, headers: { Location: `/auth?mode=signup&${q}` } });

        if (error) {
          const reason = encodeURIComponent(error);
          return state?.startsWith("signup.")
            ? toAuth(`fb=denied`)
            : back(`meta=error&reason=${reason}`);
        }
        if (!code || !state) return back("meta=error&reason=missing_params");

        const cookieState = getCookie("meta_oauth_state");
        if (!cookieState || cookieState !== state) {
          return state.startsWith("signup.") ? toAuth("fb=bad_state") : back("meta=error&reason=bad_state");
        }
        deleteCookie("meta_oauth_state", { path: "/" });

        const isSignup = state.startsWith("signup.");
        const userIdFromState = isSignup ? null : state.split(".")[0];
        if (!isSignup && !userIdFromState) return back("meta=error&reason=bad_state");

        try {
          const { exchangeCodeForToken, exchangeForLongLivedToken, fetchMetaUser, fetchMetaPermissions } =
            await import("@/lib/meta.server");

          const short = await exchangeCodeForToken(code);
          let accessToken = short.access_token;
          let expiresIn = short.expires_in;
          try {
            const long = await exchangeForLongLivedToken(accessToken);
            accessToken = long.access_token;
            expiresIn = long.expires_in;
          } catch {
            // Long-lived exchange is optional; keep short-lived token.
          }

          // ── FLUX SIGNUP: creează/leagă contul, apoi pornește sesiunea ──
          if (isSignup) {
            const { finishFacebookSignup } = await import("@/lib/facebook-signup.server");
            const origin = new URL(request.url).origin;
            const res = await finishFacebookSignup({ accessToken, expiresIn, origin });
            return res.ok
              ? new Response(null, { status: 302, headers: { Location: res.redirect } })
              : toAuth(`fb=${res.reason}`);
          }

          // ── FLUX CONECTARE (user deja logat) ──
          const { persistMetaConnection } = await import("@/lib/meta/persist.server");
          const permissions = await fetchMetaPermissions(accessToken);
          const granted = new Set<string>(
            (permissions?.data ?? [])
              .filter((p: any) => p.status === "granted")
              .map((p: any) => p.permission),
          );
          const me = await fetchMetaUser(accessToken);
          await persistMetaConnection({
            userId: userIdFromState as string,
            accessToken,
            expiresIn,
            granted,
            metaUser: { id: me.id, name: me.name },
          });
          return back("meta=connected");
        } catch (e) {
          console.error("Meta OAuth callback error", e);
          return isSignup ? toAuth("fb=failed") : back("meta=error&reason=callback_failed");
        }
      },
    },
  },
});
