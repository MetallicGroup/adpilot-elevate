import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

function safeEq(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Called by a DB trigger when a new profile (account) is created. */
export const Route = createFileRoute("/api/public/hooks/new-signup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.ADPILOT_SIGNUP_HOOK_SECRET;
        const provided = request.headers.get("x-signup-secret") ?? "";
        if (!secret || !provided || !safeEq(provided, secret)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: any = {};
        try {
          body = await request.json();
        } catch {
          body = {};
        }
        const userId = typeof body.user_id === "string" ? body.user_id : null;
        if (!userId) return new Response("Bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let email: string | null = null;
        let provider: string | null = null;
        let name: string | null = typeof body.full_name === "string" ? body.full_name : null;
        let phone: string | null = typeof body.phone === "string" ? body.phone : null;
        let referral: string | null =
          typeof body.referral_code === "string" ? body.referral_code.trim() || null : null;
        try {
          const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
          email = data?.user?.email ?? null;
          provider = (data?.user?.app_metadata as any)?.provider ?? null;
          name = name ?? ((data?.user?.user_metadata as any)?.full_name ?? null);
          phone = phone ?? ((data?.user?.user_metadata as any)?.phone ?? null);
          if (!referral) {
            referral = ((data?.user?.user_metadata as any)?.referral_code as string | undefined)?.trim() || null;
          }
        } catch (e) {
          console.error("[new-signup] user lookup failed:", e);
        }

        const loadProfile = async () => {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("referral_code, phone, full_name")
            .eq("id", userId)
            .maybeSingle();
          return profile as { referral_code?: string | null; phone?: string | null; full_name?: string | null } | null;
        };

        try {
          let profile = await loadProfile();
          referral = referral ?? profile?.referral_code ?? null;
          phone = phone ?? profile?.phone ?? null;
          name = name ?? profile?.full_name ?? null;
          // Google/FB OAuth may claim referral a moment after profile insert.
          if (!referral) {
            await new Promise((r) => setTimeout(r, 3500));
            profile = await loadProfile();
            referral = profile?.referral_code ?? null;
            phone = phone ?? profile?.phone ?? null;
            name = name ?? profile?.full_name ?? null;
          }
        } catch (e) {
          console.error("[new-signup] profile lookup failed:", e);
        }

        const { notifyAdminNewSignup } = await import("@/lib/whatsapp/admin-alerts.server");
        // Meta Conversions API — „CompleteRegistration” pentru ORICE înscriere (Facebook, Google, email).
        // Același event_id ca în browser (reg_<userId>) → Meta îl numără o singură dată.
        let capi: { sent: boolean; error?: string } = { sent: false };
        try {
          const { sendMetaCapiEvent } = await import("@/lib/meta-capi.server");
          capi = await sendMetaCapiEvent("CompleteRegistration", {
            eventId: `reg_${userId}`,
            eventSourceUrl: "https://www.adpilot.ro/auth",
            email,
            phone,
            externalId: userId,
          });
          if (!capi.sent) console.error("[new-signup] Meta CAPI not sent:", capi.error);
        } catch (e) {
          console.error("[new-signup] meta capi failed", e);
        }

        const alert = await notifyAdminNewSignup({
          email,
          name,
          phone,
          provider,
          goal: body.onboarding_goal ?? null,
          referral,
        });
        if (!alert.whatsapp.sent) {
          console.error("[new-signup] WhatsApp admin alert NOT sent:", alert.whatsapp.error);
        }
        if (!alert.email.sent) {
          console.error("[new-signup] Email admin alert NOT sent:", alert.email.error);
        }

        // TikTok Events API — conversie „CompleteRegistration" pentru reclamele AdPilot pe TikTok.
        try {
          const { sendTikTokEvent } = await import("@/lib/tiktok-events.server");
          await sendTikTokEvent("CompleteRegistration", {
            eventId: `reg_${userId}`,
            url: "https://www.adpilot.ro/auth",
            user: { email, externalId: userId },
          });
        } catch (e) {
          console.error("[new-signup] tiktok event failed", e);
        }

        return Response.json({ ok: true, alert, capi });
      },
    },
  },
});
