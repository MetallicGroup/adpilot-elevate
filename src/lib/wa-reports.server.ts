/**
 * Daily report + anomaly scan triggered by pg_cron via public hook routes.
 * Uses Lovable AI Gateway for tone polishing of summary lines.
 */
import { fetchCampaignInsights } from "./meta-insights.server";
import { getCentralWhatsApp, sendWhatsAppMessage } from "./whatsapp.server";

const GRAPH = "https://graph.facebook.com";

type Conn = {
  id: string;
  user_id: string;
  user_phone: string;
};

async function listActiveConnections() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("whatsapp_connections")
    .select("id, user_id, user_phone")
    .eq("status", "active")
    .not("user_phone", "is", null);
  return (data ?? []) as Conn[];
}

async function metaTokenFor(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("meta_connections")
    .select("access_token")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return data?.access_token ?? null;
}

async function persistOut(
  userId: string,
  connectionId: string,
  text: string,
  metaPayload?: Record<string, unknown>,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const central = getCentralWhatsApp();
  if (!central) return;
  const conn = await supabaseAdmin
    .from("whatsapp_connections")
    .select("user_phone")
    .eq("id", connectionId)
    .maybeSingle();
  const phone = conn.data?.user_phone?.replace(/\D/g, "");
  if (!phone) return;
  const { id } = await sendWhatsAppMessage(central.phoneNumberId, central.accessToken, phone, {
    type: "text",
    text,
  });
  await supabaseAdmin.from("whatsapp_messages").insert({
    user_id: userId,
    connection_id: connectionId,
    wa_message_id: id,
    direction: "out",
    msg_type: "text",
    text,
    meta: metaPayload ?? null,
  });
}

function fmtMoney(n: number) {
  return `${n.toFixed(2).replace(/\.00$/, "")} lei`;
}

/** DAILY REPORT — runs once a day per active WA user. */
export async function runDailyReports(): Promise<{ sent: number; errors: number }> {
  const conns = await listActiveConnections();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let sent = 0;
  let errors = 0;

  for (const conn of conns) {
    try {
      // Skip if already sent in last 20h
      const { data: connRow } = await supabaseAdmin
        .from("whatsapp_connections")
        .select("last_daily_report_at")
        .eq("id", conn.id)
        .maybeSingle();
      const last = connRow?.last_daily_report_at
        ? new Date(connRow.last_daily_report_at).getTime()
        : 0;
      if (Date.now() - last < 20 * 60 * 60 * 1000) continue;

      const token = await metaTokenFor(conn.user_id);
      if (!token) continue;
      const { data: camps } = await supabaseAdmin
        .from("campaigns")
        .select("id, name, meta_campaign_id, status")
        .eq("user_id", conn.user_id)
        .eq("platform", "meta")
        .not("meta_campaign_id", "is", null);
      if (!camps || !camps.length) continue;

      let totalSpend = 0;
      let totalLeads = 0;
      let totalClicks = 0;
      const perCamp: Array<{ name: string; spend: number; leads: number }> = [];
      for (const c of camps) {
        try {
          const url = new URL(`${GRAPH}/v23.0/${c.meta_campaign_id}/insights`);
          url.searchParams.set("fields", "spend,clicks,actions");
          url.searchParams.set("date_preset", "yesterday");
          url.searchParams.set("access_token", token);
          const r = await fetch(url.toString());
          const j = await r.json();
          if (!r.ok) continue;
          const row = j?.data?.[0];
          if (!row) continue;
          const spend = Number(row.spend ?? 0);
          const clicks = Number(row.clicks ?? 0);
          const leads = Number(
            (row.actions ?? []).find((a: any) => a.action_type === "lead")?.value ?? 0,
          );
          totalSpend += spend;
          totalLeads += leads;
          totalClicks += clicks;
          if (spend > 0 || leads > 0) perCamp.push({ name: c.name, spend, leads });
        } catch {
          /* ignore one campaign */
        }
      }

      if (totalSpend === 0 && totalLeads === 0) continue; // no activity → no spam

      perCamp.sort((a, b) => b.leads - a.leads || b.spend - a.spend);
      const best = perCamp[0];
      const costPerClient = totalLeads > 0 ? totalSpend / totalLeads : 0;

      const lines: string[] = [
        "📊 *Raport ieri*",
        `• Ai cheltuit *${fmtMoney(totalSpend)}*`,
        totalLeads > 0
          ? `• Ai primit *${totalLeads}* ${totalLeads === 1 ? "client nou" : "clienți noi"}`
          : "• Nu ai primit clienți noi azi",
        totalLeads > 0
          ? `• Fiecare client te-a costat *${fmtMoney(costPerClient)}*`
          : `• Ai avut *${totalClicks}* clickuri pe reclame`,
      ];
      if (best) lines.push(`• Cea mai bună reclamă: *${best.name}* — ${best.leads} clienți`);

      // Simple suggestion
      if (totalLeads === 0 && totalSpend > 0) {
        lines.push(
          "",
          "💡 Ai cheltuit dar nu au venit clienți. Poate textul sau poza nu mai prind. Vrei să-ți generez variante noi? Răspunde *da*.",
        );
      } else if (best && perCamp.length > 1) {
        lines.push(
          "",
          `💡 «${best.name}» merge cel mai bine. Vrei să-i mărim bugetul cu 20%? Răspunde *da*.`,
        );
      }

      await persistOut(conn.user_id, conn.id, lines.join("\n"));
      await supabaseAdmin
        .from("whatsapp_connections")
        .update({ last_daily_report_at: new Date().toISOString() })
        .eq("id", conn.id);
      sent++;
    } catch (e) {
      console.error("[daily-report] user", conn.user_id, e);
      errors++;
    }
  }
  return { sent, errors };
}

/** ANOMALY SCAN — runs hourly. Sends at most one alert per campaign per 12h. */
export async function runAnomalyScan(): Promise<{ alerts: number; errors: number }> {
  const conns = await listActiveConnections();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let alerts = 0;
  let errors = 0;

  for (const conn of conns) {
    try {
      const token = await metaTokenFor(conn.user_id);
      if (!token) continue;
      const { data: camps } = await supabaseAdmin
        .from("campaigns")
        .select("id, name, meta_campaign_id, status, last_anomaly_check_at, created_at")
        .eq("user_id", conn.user_id)
        .eq("platform", "meta")
        .eq("status", "active")
        .not("meta_campaign_id", "is", null);
      if (!camps) continue;

      for (const c of camps) {
        try {
          // Don't re-alert within 12h
          const last = c.last_anomaly_check_at
            ? new Date(c.last_anomaly_check_at).getTime()
            : 0;
          if (Date.now() - last < 12 * 60 * 60 * 1000) continue;

          // Need at least 12h of life to judge
          const ageH = (Date.now() - new Date(c.created_at).getTime()) / 3_600_000;
          if (ageH < 12) continue;

          const snap = await fetchCampaignInsights(c.meta_campaign_id!, token).catch(() => null);
          if (!snap) continue;

          let alert: { text: string; action: any } | null = null;

          if (snap.spend === 0) {
            alert = {
              text: `⚠️ Reclama ta *«${c.name}»* nu a cheltuit nimic în ultimele ore. Probabil targetul e prea îngust sau e oprită la Meta.\n\nVrei să o las pe pauză până rezolvăm? Răspunde *da*.`,
              action: { kind: "pause", campaign_id: c.id },
            };
          } else if (snap.leads === 0 && snap.spend > 30) {
            alert = {
              text: `⚠️ Reclama *«${c.name}»* a cheltuit *${fmtMoney(snap.spend)}* dar nu a adus niciun client. Poza sau textul nu mai prind.\n\nVrei să-ți fac 3 variante noi de text? Răspunde *da*.`,
              action: { kind: "regen_copy", campaign_id: c.id },
            };
          } else if (snap.clicks > 50 && snap.ctr < 0.5) {
            alert = {
              text: `⚠️ La reclama *«${c.name}»* foarte puțină lume dă click (sub 1 din 200). Poza nu atrage atenția.\n\nVrei să încercăm o poză nouă generată cu AI? Răspunde *da*.`,
              action: { kind: "regen_image", campaign_id: c.id },
            };
          }

          if (alert) {
            await persistOut(conn.user_id, conn.id, alert.text, {
              anomaly_action: alert.action,
            });
            await supabaseAdmin
              .from("campaigns")
              .update({ last_anomaly_check_at: new Date().toISOString() })
              .eq("id", c.id);
            alerts++;
          } else {
            // Touch timestamp even when nothing wrong — avoid recomputing every hour
            await supabaseAdmin
              .from("campaigns")
              .update({ last_anomaly_check_at: new Date().toISOString() })
              .eq("id", c.id);
          }
        } catch (e) {
          console.error("[anomaly] camp", c.id, e);
        }
      }
    } catch (e) {
      console.error("[anomaly] user", conn.user_id, e);
      errors++;
    }
  }
  return { alerts, errors };
}
