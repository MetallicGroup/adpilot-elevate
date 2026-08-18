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
        try {
          const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
          email = data?.user?.email ?? null;
          provider = (data?.user?.app_metadata as any)?.provider ?? null;
          name = name ?? ((data?.user?.user_metadata as any)?.full_name ?? null);
        } catch (e) {
          console.error("[new-signup] user lookup failed:", e);
        }

        const { notifyAdminNewSignup } = await import("@/lib/whatsapp/admin-alerts.server");
        const alert = await notifyAdminNewSignup({
          email,
          name,
          provider,
          goal: body.onboarding_goal ?? null,
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

        return Response.json({ ok: true, alert });
      },
    },
  },
});
