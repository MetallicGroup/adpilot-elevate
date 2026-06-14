/**
 * Shared helper for ACTIVE/PAUSED toggling on Meta + local mirror.
 * Used by both the user-facing server fn and the WhatsApp agent.
 */
import { metaApiVersion } from "./meta.server";

const GRAPH = "https://graph.facebook.com";

export type LocalStatus = "active" | "paused" | "draft";

export async function setMetaCampaignStatus(opts: {
  userId: string;
  campaignId: string;
  next: "ACTIVE" | "PAUSED";
}): Promise<{ ok: true; status: "ACTIVE" | "PAUSED" } | { error: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: camp } = await supabaseAdmin
    .from("campaigns")
    .select("id, meta_campaign_id")
    .eq("id", opts.campaignId)
    .eq("user_id", opts.userId)
    .maybeSingle();
  if (!camp) return { error: "Campanie negăsită" };
  if (!camp.meta_campaign_id) return { error: "Campanie nepublicată pe Meta" };

  const { data: conn } = await supabaseAdmin
    .from("meta_connections")
    .select("access_token")
    .eq("user_id", opts.userId)
    .eq("is_active", true)
    .maybeSingle();
  if (!conn?.access_token) return { error: "Fără conexiune Meta" };

  const r = await fetch(`${GRAPH}/${metaApiVersion()}/${camp.meta_campaign_id}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `status=${opts.next}&access_token=${encodeURIComponent(conn.access_token)}`,
  });
  const j = await r.json();
  if (!r.ok) return { error: j?.error?.message || `Meta ${r.status}` };

  await supabaseAdmin
    .from("campaigns")
    .update({ status: opts.next === "ACTIVE" ? "active" : "paused" })
    .eq("id", opts.campaignId);

  return { ok: true, status: opts.next };
}

/** Pull current status of every published Meta campaign and mirror to DB. */
export async function syncMetaCampaignStatuses(): Promise<{ synced: number; changed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: camps } = await supabaseAdmin
    .from("campaigns")
    .select("id, user_id, status, meta_campaign_id")
    .eq("platform", "meta")
    .not("meta_campaign_id", "is", null);
  if (!camps?.length) return { synced: 0, changed: 0 };

  const v = metaApiVersion();
  const byUser = new Map<string, typeof camps>();
  for (const c of camps) {
    const arr = byUser.get(c.user_id) ?? [];
    arr.push(c);
    byUser.set(c.user_id, arr);
  }

  let synced = 0;
  let changed = 0;

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
        const r = await fetch(
          `${GRAPH}/${v}/${c.meta_campaign_id}?fields=status,effective_status&access_token=${encodeURIComponent(conn.access_token)}`,
        );
        const j: any = await r.json();
        if (!r.ok) continue;
        synced++;
        // Meta status: ACTIVE / PAUSED / DELETED / ARCHIVED
        const metaStatus: string = (j?.status ?? "").toUpperCase();
        let local: LocalStatus | null = null;
        if (metaStatus === "ACTIVE") local = "active";
        else if (metaStatus === "PAUSED") local = "paused";
        else if (metaStatus === "DELETED" || metaStatus === "ARCHIVED") local = "paused";
        if (local && local !== c.status) {
          await supabaseAdmin.from("campaigns").update({ status: local }).eq("id", c.id);
          changed++;
        }
      } catch {
        // continue
      }
    }
  }
  return { synced, changed };
}