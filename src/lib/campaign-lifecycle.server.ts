/**
 * Ciclul de după lansare (Meta): urmărește reclamele noi și îi spune patronului, o singură dată,
 * când reclama a fost aprobată și a început să ruleze, când e respinsă sau când e aprobată
 * dar nu rulează (de obicei lipsește cardul la Facebook). Rulează din cron la ~10 minute.
 */
import { metaApiVersion } from "./meta.server";
import { notifyOwner, WA_TEMPLATES } from "./wa-notify.server";

const GRAPH = "https://graph.facebook.com";
const WATCH_DAYS = 14;
const STALL_AFTER_MS = 6 * 60 * 60 * 1000;

async function graph(path: string, token: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH}/${metaApiVersion()}/${path}?${qs.toString()}`);
  const json: any = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? `Meta ${res.status}`);
  return json;
}

/** Motivul respingerii, din ad_review_feedback (Meta îl dă ca obiect {motiv: explicație}). */
function rejectionReason(feedback: any): string | null {
  const global = feedback?.global ?? feedback?.placement_specific ?? null;
  if (!global || typeof global !== "object") return null;
  const parts = Object.entries(global).map(([k, v]) => (typeof v === "string" && v ? v : k));
  return parts.length ? parts.join(" ").slice(0, 300) : null;
}

export async function runCampaignLifecycle(): Promise<{ checked: number; notified: number; errors: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - WATCH_DAYS * 86400_000).toISOString();
  const { data: camps } = await supabaseAdmin
    .from("campaigns")
    .select(
      "id, user_id, name, created_at, meta_ad_id, review_state, live_notified_at, rejected_notified_at, stalled_notified_at",
    )
    .eq("platform", "meta")
    .gte("created_at", since)
    .not("meta_ad_id", "is", null)
    .is("live_notified_at", null)
    .is("rejected_notified_at", null);

  let checked = 0;
  let notified = 0;
  let errors = 0;
  const tokens = new Map<string, string | null>();
  const adAccounts = new Map<string, string | null>();

  for (const c of (camps ?? []) as any[]) {
    try {
      if (!tokens.has(c.user_id)) {
        const { data: conn } = await (supabaseAdmin as any)
          .from("meta_connections")
          .select("access_token")
          .eq("user_id", c.user_id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        tokens.set(c.user_id, conn?.access_token ?? null);
      }
      const token = tokens.get(c.user_id);
      if (!token) continue;
      checked++;

      const ad = await graph(c.meta_ad_id, token, { fields: "effective_status,ad_review_feedback,account_id" });
      const status: string = ad?.effective_status ?? "";
      const update: Record<string, unknown> = {};

      if (status === "DISAPPROVED") {
        const reason = rejectionReason(ad.ad_review_feedback);
        update.review_state = "rejected";
        update.review_reason = reason;
        const r = await notifyOwner(supabaseAdmin, c.user_id, {
          text: `⚠️ Facebook a respins reclama *${c.name}*.${reason ? `\n\nMotivul dat de Facebook: _${reason}_` : ""}\n\nScrie-mi aici și o refacem împreună, cu un text care trece de verificare.`,
          template: { name: WA_TEMPLATES.adRejected, params: [c.name, "Facebook"] },
          kind: "ad_rejected",
        });
        if ("sent" in r) {
          update.rejected_notified_at = new Date().toISOString();
          notified++;
        }
      } else if (status === "PENDING_REVIEW" || status === "IN_PROCESS") {
        update.review_state = "in_review";
      } else {
        const ins = await graph(`${c.meta_ad_id}/insights`, token, { date_preset: "maximum", fields: "impressions" });
        const impressions = Number(ins?.data?.[0]?.impressions ?? 0);
        if (impressions > 0) {
          update.review_state = "delivering";
          const r = await notifyOwner(supabaseAdmin, c.user_id, {
            text: `✅ Facebook a aprobat reclama *${c.name}* și a început să ruleze (${impressions} afișări până acum).\n\nÎți scriu imediat ce vine primul client.`,
            template: { name: WA_TEMPLATES.adLive, params: [c.name, "Facebook"] },
            kind: "ad_live",
          });
          if ("sent" in r) {
            update.live_notified_at = new Date().toISOString();
            notified++;
          }
        } else if (status === "ACTIVE") {
          update.review_state = "approved";
          const age = Date.now() - new Date(c.created_at).getTime();
          if (age > STALL_AFTER_MS && !c.stalled_notified_at) {
            const accountId = String(ad.account_id ?? "");
            if (!adAccounts.has(accountId)) {
              const acct = await graph(`act_${accountId}`, token, { fields: "funding_source_details" }).catch(() => null);
              const f = acct?.funding_source_details;
              adAccounts.set(accountId, f && (f.id || f.display_string) ? "card" : null);
            }
            const hasCard = adAccounts.get(accountId) === "card";
            const text = hasCard
              ? `ℹ️ Reclama *${c.name}* e aprobată, dar Facebook încă n-a început s-o afișeze. Uneori durează câteva ore; dacă vrei, mă uit împreună cu tine la buget și public.`
              : `ℹ️ Reclama *${c.name}* e aprobată, dar nu rulează pentru că lipsește cardul în contul de reclame Facebook. Adaugă-l aici și pornește singură:\nhttps://business.facebook.com/ads/manager/account_settings/account_billing/?act=${accountId}`;
            const r = await notifyOwner(supabaseAdmin, c.user_id, { text, kind: "ad_stalled" });
            if ("sent" in r) {
              update.stalled_notified_at = new Date().toISOString();
              notified++;
            }
          }
        } else if (status) {
          update.review_state = status.toLowerCase();
        }
      }

      if (Object.keys(update).length) {
        await (supabaseAdmin as any).from("campaigns").update(update).eq("id", c.id);
      }
    } catch (e) {
      errors++;
      console.error("[lifecycle] campaign", c.id, (e as Error).message);
    }
  }
  return { checked, notified, errors };
}
