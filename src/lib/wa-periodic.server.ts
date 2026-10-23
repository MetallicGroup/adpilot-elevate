/**
 * Auto-refresh insights (every minute) + per-campaign WhatsApp pulse (hourly).
 * Pulse-ul cu date despre reclame se trimite DOAR pentru campanii ACTIVE fără erori
 * pe Meta (isMetaCampaignActive verifică effective_status === "ACTIVE") și se oprește
 * automat când reclama e pusă pe pauză / respinsă / cu probleme.
 */
import { fetchCampaignInsights, fetchCampaignDailyInsights } from "./meta-insights.server";
import { getCentralWhatsApp } from "./whatsapp.server";
import { syncMetaCampaignStatuses, isMetaCampaignActive } from "./campaign-control.server";

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
  // Pornește ceasul lunar de 7 zile al planului gratuit când prima reclamă e activă.
  try {
    const { startFreePlanClocks } = await import("./free-plan.server");
    await startFreePlanClocks();
  } catch (e) {
    console.error("[refresh-insights] free-plan clocks", e);
  }
  // TikTok: o dată la 10 minute (API-ul lor are limite mai strânse).
  if (new Date().getUTCMinutes() % 10 === 0) {
    try {
      await refreshTikTokInsights(supabaseAdmin);
    } catch (e) {
      console.error("[refresh-insights] tiktok", e);
    }
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
        // Valori PE ZI (nu cumulat) → înlocuim complet istoricul campaniei ca să
        // nu rămână rânduri cumulate vechi care s-ar aduna greșit.
        const days = await fetchCampaignDailyInsights(c.meta_campaign_id!, conn.access_token);
        if (days.length) {
          await supabaseAdmin.from("performance_data").delete().eq("campaign_id", c.id);
          await supabaseAdmin.from("performance_data").insert(
            days.map((d) => ({
              user_id: userId,
              campaign_id: c.id,
              date: d.date,
              spend: d.spend,
              impressions: d.impressions,
              clicks: d.clicks,
              ctr: d.ctr,
              leads: d.leads,
              cpl: d.cpl,
            })),
          );
        }
        refreshed++;
      } catch (e) {
        console.error("[refresh-insights]", c.id, e);
        errors++;
      }
    }
  }
  return { refreshed, errors };
}

/** Statisticile zilnice ale campaniilor TikTok în performance_data (dashboard, rapoarte). */
async function refreshTikTokInsights(db: any): Promise<void> {
  const { data: camps } = await db
    .from("campaigns")
    .select("id, user_id, tiktok_campaign_id")
    .eq("platform", "tiktok")
    .in("status", ["active", "paused"])
    .not("tiktok_campaign_id", "is", null);
  if (!camps?.length) return;
  const tt = await import("./tiktok-ads.server");
  for (const c of camps) {
    try {
      const ctx = await tt.getTikTokAdContext(db, c.user_id);
      if (!ctx) continue;
      const days = await tt.getTikTokCampaignDaily(ctx, c.tiktok_campaign_id, 30);
      if (!days.length) continue;
      const { data: leads } = await db.from("leads").select("created_at").eq("campaign_id", c.id);
      const leadsByDay = new Map<string, number>();
      for (const l of leads ?? []) {
        const d = String(l.created_at).slice(0, 10);
        leadsByDay.set(d, (leadsByDay.get(d) ?? 0) + 1);
      }
      await db.from("performance_data").delete().eq("campaign_id", c.id);
      await db.from("performance_data").insert(
        days.map((d) => {
          const lds = leadsByDay.get(d.date) ?? 0;
          return {
            user_id: c.user_id,
            campaign_id: c.id,
            date: d.date,
            spend: d.spend,
            impressions: d.impressions,
            clicks: d.clicks,
            ctr: d.impressions ? (d.clicks / d.impressions) * 100 : 0,
            leads: lds,
            cpl: lds ? d.spend / lds : 0,
          };
        }),
      );
    } catch (e) {
      console.error("[refresh-insights] tiktok campaign", c.id, (e as Error).message);
    }
  }
}

/** Send a per-campaign WhatsApp pulse (spend / views / clicks / leads) hourly. */
export async function runPeriodicUpdates(): Promise<{ sent: number; errors: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const central = getCentralWhatsApp();
  if (!central) return { sent: 0, errors: 0 };
  // Fără actualizări de rutină noaptea (21:00–09:00, ora României).
  const { isQuietHours } = await import("./wa-notify.server");
  if (isQuietHours()) return { sent: 0, errors: 0 };

  const { data: conns } = await supabaseAdmin
    .from("whatsapp_connections")
    .select("id, user_id, user_phone, keepalive_opt_out")
    .eq("status", "active")
    .eq("keepalive_opt_out", false)
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
        return Date.now() - last >= 59 * 60 * 1000; // ~1h
      });
      if (!due.length) continue;

      const phone = conn.user_phone!.replace(/\D/g, "");
      if (!phone) continue;

      for (const c of due) {
        try {
          // Nu trimite update dacă reclama nu e ACTIVĂ pe Meta chiar acum
          const live = await isMetaCampaignActive(c.meta_campaign_id, metaConn.access_token);
          if (!live) continue;
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

          // Rutină: fără mesaje noaptea și fără mesaje care oricum n-ar ajunge (în afara ferestrei de 24h).
          const { notifyOwner } = await import("./wa-notify.server");
          const r = await notifyOwner(supabaseAdmin, conn.user_id, {
            text: lines,
            respectQuietHours: true,
            kind: "periodic_update",
          });
          if (!("sent" in r)) continue;
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