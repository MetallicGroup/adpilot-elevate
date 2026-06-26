import { createFileRoute } from "@tanstack/react-router";

/**
 * Meta Lead Ads webhook.
 *  - GET  : subscription verification (hub.mode=subscribe)
 *  - POST : signed leadgen event → fetch lead via Graph API → insert into `leads`
 * Public path → bypasses Lovable auth on published sites; signature is enforced here.
 */
export const Route = createFileRoute("/api/public/meta/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
        if (mode === "subscribe" && token && expected && token === expected) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-hub-signature-256");
        const appSecret = process.env.META_APP_SECRET;
        if (!appSecret) return new Response("Server misconfigured", { status: 500 });

        const { verifyMetaSignature, fetchMetaLead, mapMetaLeadFields } = await import(
          "@/lib/leads.server"
        );
        const ok = await verifyMetaSignature(raw, sig, appSecret);
        if (!ok) return new Response("Invalid signature", { status: 401 });

        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        if (payload?.object !== "page") {
          // ack non-page subscriptions (so Meta doesn't retry forever)
          return new Response("ok", { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const entries: any[] = Array.isArray(payload.entry) ? payload.entry : [];

        for (const entry of entries) {
          const pageId: string | undefined = entry?.id;
          const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
          for (const change of changes) {
            if (change?.field !== "leadgen") continue;
            const value = change.value || {};
            const leadgenId: string | undefined = value.leadgen_id;
            if (!leadgenId || !pageId) continue;

            // Resolve page → user + page access token
            const { data: page } = await supabaseAdmin
              .from("meta_pages")
              .select("user_id, page_access_token, page_id")
              .eq("page_id", pageId)
              .maybeSingle();
            if (!page?.user_id || !page.page_access_token) continue;

            let lead;
            try {
              lead = await fetchMetaLead(leadgenId, page.page_access_token);
            } catch (e) {
              console.error("[meta webhook] fetchMetaLead failed", leadgenId, e);
              continue;
            }

            const mapped = mapMetaLeadFields(lead.field_data || []);

            // Try to attach to a campaign owned by this user (by stored meta_ad_id)
            let campaign_id: string | null = null;
            const adId = lead.ad_id ?? value.ad_id ?? null;
            if (adId) {
              const { data: camp } = await supabaseAdmin
                .from("campaigns")
                .select("id")
                .eq("user_id", page.user_id)
                .eq("meta_ad_id", adId)
                .maybeSingle();
              campaign_id = camp?.id ?? null;
            }

            const insert = {
              user_id: page.user_id,
              platform: "meta" as const,
              campaign_id,
              external_lead_id: leadgenId,
              external_form_id: lead.form_id ?? value.form_id ?? null,
              external_ad_id: adId,
              external_campaign_id: value.adgroup_id ?? null,
              full_name: mapped.full_name,
              email: mapped.email,
              phone: mapped.phone,
              message: mapped.message,
              raw: lead as any,
              source_url: null,
              status: "new" as const,
            };

            // Dedup: ignore conflict on external_lead_id or email/phone+campaign
            const { error } = await supabaseAdmin
              .from("leads")
              .upsert(insert, { onConflict: "platform,external_lead_id", ignoreDuplicates: true });
            if (error) console.error("[meta webhook] insert error", error.message);

            // Notify on WhatsApp if user has a connection
            try {
              const { data: waConn } = await supabaseAdmin
                .from("whatsapp_connections")
                .select("user_phone")
                .eq("user_id", page.user_id)
                .eq("status", "active")
                .maybeSingle();
              const { getCentralWhatsApp, sendWhatsAppMessage } = await import(
                "@/lib/whatsapp.server"
              );
              const central = getCentralWhatsApp();
              if (waConn?.user_phone && central) {
                const campName = campaign_id
                  ? (await supabaseAdmin.from("campaigns").select("name").eq("id", campaign_id).maybeSingle()).data?.name
                  : "—";
                const lines = [
                  "🎯 *Lead nou*",
                  campName ? `📣 Campania: ${campName}` : "",
                  mapped.full_name ? `👤 ${mapped.full_name}` : "",
                  mapped.phone ? `📞 ${mapped.phone}` : "",
                  mapped.email ? `✉️ ${mapped.email}` : "",
                  mapped.message ? `💬 "${mapped.message}"` : "",
                  "",
                  "Scrie *lead-uri* să vezi ultimele sau întreabă-mă orice 🚀",
                ].filter(Boolean).join("\n");
                const toPhone = waConn.user_phone.replace(/\D/g, "");
                if (toPhone) {
                  await sendWhatsAppMessage(central.phoneNumberId, central.accessToken, toPhone, {
                    type: "text",
                    text: lines,
                  });
                }
              }
            } catch (e) {
              console.error("[meta webhook] WA notify failed", e);
            }
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});