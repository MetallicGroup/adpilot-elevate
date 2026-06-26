// @ts-nocheck
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getMetaInsightsSummary, syncMetaInsights } from "@/lib/meta/insights";
import { sendDailyReport } from "./notifications";

/**
 * Daily report scheduler structure.
 * TODO: Wire to Cloudflare Cron Trigger or external scheduler (e.g. daily at 20:00 Europe/Bucharest).
 */
export async function runDailyReportsForAllUsers() {
  const { data: users } = await supabaseAdmin
    .from("user_whatsapp_phones")
    .select("user_id")
    .eq("verified", true);

  const uniqueUsers = [...new Set((users ?? []).map((u) => u.user_id))];

  for (const userId of uniqueUsers) {
    try {
      await syncMetaInsights(userId);
      const summary = await getMetaInsightsSummary(userId);
      await sendDailyReport(userId, {
        spend: summary.spend,
        leads: summary.leads,
        cpl: summary.cpl,
        clicks: summary.clicks,
        ctr: summary.ctr,
        recommendation:
          summary.leads >= 2
            ? "Reclama merge bine. Recomandăm să păstrăm bugetul încă 24h."
            : "Încă adunăm date. Verificăm din nou mâine.",
      });
    } catch (err) {
      console.error(`[DailyReport] Failed for user ${userId}:`, err);
    }
  }

  return { processed: uniqueUsers.length };
}