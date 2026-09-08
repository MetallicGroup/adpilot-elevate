import { createFileRoute } from "@tanstack/react-router";

/**
 * Link scurt de plată pentru WhatsApp: /api/public/pay/<pay_token>.
 * Găsește contul după pay_token, creează o sesiune Stripe Checkout GĂZDUITĂ pentru
 * planul ales (asociată la userId prin metadata) și redirectează userul acolo.
 * La plată, webhook-ul existent leagă abonamentul de contul lui.
 */
export const Route = createFileRoute("/api/public/pay/$token")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { token: string } }) => {
        const token = params?.token ?? "";
        const uuid = /^[0-9a-fA-F-]{36}$/;
        const toPricing = () =>
          new Response(null, { status: 302, headers: { Location: "https://www.adpilot.ro/pricing" } });
        if (!uuid.test(token)) return toPricing();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profile } = await (supabaseAdmin as any)
          .from("profiles")
          .select("id, chosen_plan")
          .eq("pay_token", token)
          .maybeSingle();
        if (!profile?.id) return toPricing();

        // Deja plătit? Trimite-l în cont.
        const { resolveAccess } = await import("@/lib/access.server");
        const access = await resolveAccess(supabaseAdmin, profile.id);
        if (access.paid) {
          return new Response(null, {
            status: 302,
            headers: { Location: "https://www.adpilot.ro/dashboard" },
          });
        }

        const { data: au } = await supabaseAdmin.auth.admin.getUserById(profile.id);
        const email = au?.user?.email ?? null;

        const { createReactivationCheckoutUrl } = await import("@/lib/reactivation.server");
        const { url } = await createReactivationCheckoutUrl({
          userId: profile.id,
          email,
          chosenPlan: profile.chosen_plan ?? null,
        });
        if (!url) return toPricing();
        return new Response(null, { status: 302, headers: { Location: url } });
      },
    },
  },
});
