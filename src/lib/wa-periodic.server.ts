/**
 * Auto-refresh insights (every minute) + per-campaign WhatsApp pulse (every 30m).
 */
import { fetchCampaignInsights } from "./meta-insights.server";
import { getCentralWhatsApp, sendWhatsAppMessage } from "./whatsapp.server";
import { syncMetaCampaignStatuses } from "./campaign-control.server";

type Camp = {
  id: string;
  user_id: string;
  name: string;
  meta_campaign_id: string;
  last_periodic_update_at: string | null;
};

function fmtMoney(n: number) {
  return `${n.toFixed(2).replace(/\.00$/, "")} lei`;
}

/** Refresh today's performance_data for every active Meta campaign across all users. */
export async function refreshAllInsights(): Promise<{ refreshed: number; errors: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Mirror Meta campaign status (ACTIVE/PAUSED/DELETED) into local DB first
  try {
    await syncMetaCampaignStatuses();
  } catch (e) {
    console.error("[refresh-insights] status sync", e);
  }
  const { data: camps } = await supabaseAdmin
    .from("campaigns")
    .select("id, user_id, meta_campaign_id")
    .eq("platform", "meta")
    .in("status", ["active", "paused"])
    .not("meta_campaign_id", "is", null);
  if (!camps?.length) return { refreshed: 0, errors: 0 };

  // Group by user → fetch token once
  const byUser = new Map<string, typeof camps>();
  for (const c of camps) {
    const arr = byUser.get(c.user_id) ?? [];
    arr.push(c);
    byUser.set(c.user_id, arr);
  }

  const today = new Date().toISOString().slice(0, 10);
  let refreshed = 0;
  let errors = 0;

  for (const [userId, list] of byUser) {
    const { data: conn } = await supabaseAdmin
      .from("meta_connections")
      .select("access_token")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!conn?.access_token) continue;
    for (const c of list) {
      try {
        const snap = await fetchCampaignInsights(c.meta_campaign_id!, conn.access_token);
        await supabaseAdmin.from("performance_data").upsert(
          {
            user_id: userId,
            campaign_id: c.id,
            date: today,
            spend: snap.spend,
            impressions: snap.impressions,
            clicks: snap.clicks,
            ctr: snap.ctr,
            leads: snap.leads,
            cpl: snap.cpl,
          },
          { onConflict: "campaign_id,date" },
        );
        refreshed++;
      } catch (e) {
        console.error("[refresh-insights]", c.id, e);
        errors++;
      }
    }
  }
  return { refreshed, errors };
}

/** Send a per-campaign WhatsApp pulse (spend / views / clicks / leads) every ~30m. */
export async function runPeriodicUpdates(): Promise<{ sent: number; errors: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const central = getCentralWhatsApp();
  if (!central) return { sent: 0, errors: 0 };

  const { data: conns } = await supabaseAdmin
    .from("whatsapp_connections")
    .select("id, user_id, user_phone")
    .eq("status", "active")
    .not("user_phone", "is", null);
  if (!conns?.length) return { sent: 0, errors: 0 };

  let sent = 0;
  let errors = 0;

  for (const conn of conns) {
    try {
      const { data: camps } = await supabaseAdmin
        .from("campaigns")
        .select("id, user_id, name, meta_campaign_id, last_periodic_update_at")
        .eq("user_id", conn.user_id)
        .eq("platform", "meta")
        .eq("status", "active")
        .not("meta_campaign_id", "is", null);
      if (!camps?.length) continue;

      const { data: metaConn } = await supabaseAdmin
        .from("meta_connections")
        .select("access_token")
        .eq("user_id", conn.user_id)
        .eq("is_active", true)
        .maybeSingle();
      if (!metaConn?.access_token) continue;

      const due = (camps as Camp[]).filter((c) => {
        const last = c.last_periodic_update_at
          ? new Date(c.last_periodic_update_at).getTime()
          : 0;
        return Date.now() - last >= 29 * 60 * 1000; // ~30 min
      });
      if (!due.length) continue;

      const phone = conn.user_phone!.replace(/\D/g, "");
      if (!phone) continue;

      for (const c of due) {
        try {
          const snap = await fetchCampaignInsights(c.meta_campaign_id, metaConn.access_token);
          const lines = [
            `📣 *${c.name}* — actualizare`,
            `💸 Cheltuit: *${fmtMoney(snap.spend)}*`,
            `👀 Vizionări: *${snap.impressions}*`,
            `🖱️ Clickuri: *${snap.clicks}*`,
            `🎯 Clienți noi: *${snap.leads}*`,
            snap.leads > 0 ? `💰 Cost per client: *${fmtMoney(snap.cpl)}*` : "",
          ]
            .filter(Boolean)
            .join("\n");

          const { id } = await sendWhatsAppMessage(
            central.phoneNumberId,
            central.accessToken,
            phone,
            { type: "text", text: lines },
          );
          await supabaseAdmin.from("whatsapp_messages").insert({
            user_id: conn.user_id,
            connection_id: conn.id,
            wa_message_id: id,
            direction: "out",
            msg_type: "text",
            text: lines,
          });
          await supabaseAdmin
            .from("campaigns")
            .update({ last_periodic_update_at: new Date().toISOString() })
            .eq("id", c.id);
          sent++;
        } catch (e) {
          console.error("[periodic-update] camp", c.id, e);
          errors++;
        }
      }
    } catch (e) {
      console.error("[periodic-update] user", conn.user_id, e);
      errors++;
    }
  }
  return { sent, errors };
}