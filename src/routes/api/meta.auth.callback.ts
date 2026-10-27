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
        const safeReturn = ["/onboarding", "/start", "/conectat"].includes(returnTo) ? returnTo : "/settings";
        // /conectat = linkul personal trimis pe WhatsApp (fără sesiune în browser).
        const viaLink = safeReturn === "/conectat";
        deleteCookie("meta_oauth_return", { path: "/" });
        const back = (q: string) =>
          new Response(null, {
            status: 302,
            headers: { Location: `${safeReturn}?${q}` },
          });
        // Erorile de signup nu au sesiune → le trimitem la pagina de auth, nu în app.
        const toAuth = (q: string) =>
          new Response(null, { status: 302, headers: { Location: `/auth?mode=signup&${q}` } });
        // Clienții de agenție revin pe /connect/[slug].
        const slugOf = (s: string | null) => (s ?? "").split(".")[1] ?? "";
        const toConnect = (s: string | null, q: string) =>
          new Response(null, {
            status: 302,
            headers: { Location: `/connect/${encodeURIComponent(slugOf(s))}?${q}` },
          });

        if (error) {
          if (state?.startsWith("signup.")) return toAuth(`fb=denied`);
          if (state?.startsWith("agency.")) return toConnect(state, "err=denied");
          return back(`meta=error&reason=${encodeURIComponent(error)}`);
        }
        if (!code || !state) return back("meta=error&reason=missing_params");

        const cookieState = getCookie("meta_oauth_state");
        if (!cookieState || cookieState !== state) {
          if (state.startsWith("signup.")) return toAuth("fb=bad_state");
          if (state.startsWith("agency.")) return toConnect(state, "err=bad_state");
          return back("meta=error&reason=bad_state");
        }
        deleteCookie("meta_oauth_state", { path: "/" });

        const isSignup = state.startsWith("signup.");
        const isAgency = state.startsWith("agency.");
        const userIdFromState = isSignup || isAgency ? null : state.split(".")[0];
        if (!isSignup && !isAgency && !userIdFromState) return back("meta=error&reason=bad_state");

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
            const rawRef = getCookie("adpilot_referral");
            let referralCode: string | null = null;
            if (rawRef) {
              try {
                referralCode = decodeURIComponent(rawRef).trim().slice(0, 40) || null;
              } catch {
                referralCode = rawRef.trim().slice(0, 40) || null;
              }
              deleteCookie("adpilot_referral", { path: "/" });
            }
            const res = await finishFacebookSignup({
              accessToken,
              expiresIn,
              origin,
              referralCode,
            });
            if (res.ok) return new Response(null, { status: 302, headers: { Location: res.redirect } });
            // Fără cont: nu mai creăm unul de aici, îl trimitem în fluxul nou.
            if (res.reason === "no_account") {
              return new Response(null, { status: 302, headers: { Location: "/start?nou=facebook" } });
            }
            return toAuth(`fb=${res.reason}`);
          }

          // ── FLUX AGENȚIE: clientul se conectează la o agenție (fără user nou) ──
          if (isAgency) {
            const slug = slugOf(state);
            const { finishAgencyConnect } = await import("@/lib/agency.server");
            const res = await finishAgencyConnect({ accessToken, expiresIn, slug });
            return res.ok
              ? toConnect(state, "done=1")
              : toConnect(state, `err=${res.reason}`);
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
          if (viaLink) {
            const { getCentralWhatsApp } = await import("@/lib/whatsapp.server");
            const { notifyOwner } = await import("@/lib/wa-notify.server");
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            try {
              await notifyOwner(supabaseAdmin, userIdFromState as string, {
                kind: "meta_connected",
                text: "Gata, Facebook-ul tău e conectat la AdPilot ✅ Hai să pornim reclama: trimite-mi aici pozele sau clipul, dacă nu mi le-ai trimis deja.",
              });
            } catch (e) {
              console.error("[meta-callback] notify connected", (e as Error).message);
            }
            const wa = getCentralWhatsApp()?.displayNumber;
            return back(`meta=connected${wa ? `&wa=${wa}` : ""}`);
          }
          return back("meta=connected");
        } catch (e) {
          console.error("Meta OAuth callback error", e);
          if (isSignup) return toAuth("fb=failed");
          if (isAgency) return toConnect(state, "err=failed");
          return back("meta=error&reason=callback_failed");
        }
      },
    },
  },
});
