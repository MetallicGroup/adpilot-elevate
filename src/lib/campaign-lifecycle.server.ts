/**
 * Ciclul de după lansare (Meta): urmărește reclamele noi și îi spune patronului, o singură dată,
 * când reclama a fost aprobată și a început să ruleze, când e respinsă sau când e aprobată
 * dar nu rulează (de obicei lipsește cardul la Facebook). Rulează din cron la ~10 minute.
 */
import { metaApiVersion } from "./meta.server";
import { notifyOwner, isQuietHours } from "./wa-notify.server";
import { explainAdIssues } from "./meta-errors.server";

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

      const ad = await graph(c.meta_ad_id, token, { fields: "effective_status,ad_review_feedback,account_id,issues_info" });
      const status: string = ad?.effective_status ?? "";
      const update: Record<string, unknown> = {};
      const issue = explainAdIssues(ad?.issues_info, { adAccountId: String(ad?.account_id ?? "") || null });

      if (issue && (status === "WITH_ISSUES" || status === "PAUSED" || status === "CAMPAIGN_PAUSED" || status === "ADSET_PAUSED")) {
        // Meta a oprit reclama după creare (ex. verificarea de securitate a contului): îi spunem exact ce are de făcut, o dată.
        const state = `issue_${issue.kind}`;
        if (c.review_state !== state) {
          const r = await notifyOwner(supabaseAdmin, c.user_id, {
            text: `⚠️ Reclama *${c.name}* nu rulează încă.\n\n${issue.user_message}`,
            holdIfClosed: true,
            kind: "ad_issue",
          });
          if ("sent" in r || "held" in r) notified++;
        }
        update.review_state = state;
      } else if (status === "DISAPPROVED") {
        const reason = rejectionReason(ad.ad_review_feedback);
        update.review_state = "rejected";
        update.review_reason = reason;
        const r = await notifyOwner(supabaseAdmin, c.user_id, {
          text: `⚠️ Facebook a respins reclama *${c.name}*.${reason ? `\n\nMotivul dat de Facebook: _${reason}_` : ""}\n\nPot pregăti o variantă corectată (text fără afirmațiile care nu trec), cu aceeași poză și aceleași setări.`,
          holdIfClosed: true,
          kind: "ad_rejected",
          buttons: [
            { id: `perf:fix_rejected:${c.id}`, title: "Refă reclama" },
            { id: `perf:ignore:${c.id}`, title: "Lasă așa" },
          ],
          meta: { anomaly_action: { kind: "fix_rejected", campaign_id: c.id, reason } },
        });
        if ("sent" in r || "held" in r) {
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
            holdIfClosed: true,
            kind: "ad_live",
          });
          if ("sent" in r || "held" in r) {
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
            const r = await notifyOwner(supabaseAdmin, c.user_id, { text, holdIfClosed: true, kind: "ad_stalled" });
            if ("sent" in r || "held" in r) {
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
  const tk = await runTikTokLifecycle(supabaseAdmin);
  const perf = await runPerformanceChecks(supabaseAdmin).catch((e) => {
    console.error("[lifecycle] performance", (e as Error).message);
    return { notified: 0 };
  });
  return {
    checked: checked + tk.checked,
    notified: notified + tk.notified + perf.notified,
    errors: errors + tk.errors,
  };
}

const LEAD_ACTIONS = ["lead", "onsite_conversion.lead_grouped"];
const CONVO_ACTIONS = ["onsite_conversion.messaging_conversation_started_7d"];

function actionMax(actions: Array<{ action_type: string; value: string }> | undefined, types: string[]): number {
  return Math.max(0, ...(actions ?? []).filter((a) => types.includes(a.action_type)).map((a) => Number(a.value) || 0));
}

/**
 * Verificarea de după 24h și 48h de rulare (o dată fiecare): oamenii dau click dar nu trimit formularul,
 * sau s-a cheltuit bugetul fără niciun rezultat. Propune schimbarea concretă, cu butoane;
 * la „da”, agentul o face (vezi anomaly_action).
 */
async function runPerformanceChecks(supabaseAdmin: any): Promise<{ notified: number }> {
  if (isQuietHours()) return { notified: 0 };
  const { data: camps } = await supabaseAdmin
    .from("campaigns")
    .select("id, user_id, name, objective, budget, creative, live_notified_at, meta_campaign_id, status")
    .eq("platform", "meta")
    .eq("status", "active")
    .not("live_notified_at", "is", null)
    .not("meta_campaign_id", "is", null)
    .gte("live_notified_at", new Date(Date.now() - 4 * 86400_000).toISOString());
  let notified = 0;
  for (const c of (camps ?? []) as any[]) {
    const hours = (Date.now() - new Date(c.live_notified_at).getTime()) / 3600_000;
    const monitor = (c.creative?.monitor ?? {}) as Record<string, string>;
    const stage = hours >= 48 && !monitor.d2_at ? "d2_at" : hours >= 24 && !monitor.d1_at ? "d1_at" : null;
    if (!stage) continue;
    try {
      const { data: conn } = await supabaseAdmin
        .from("meta_connections")
        .select("access_token")
        .eq("user_id", c.user_id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!conn?.access_token) continue;
      const ins = await graph(`${c.meta_campaign_id}/insights`, conn.access_token, {
        date_preset: "maximum",
        fields: "spend,impressions,inline_link_clicks,actions",
      });
      const row = ins?.data?.[0] ?? {};
      const spend = Number(row.spend ?? 0);
      const clicks = Number(row.inline_link_clicks ?? 0);
      const isMessages = c.objective === "MESSAGES";
      const results = actionMax(row.actions, isMessages ? CONVO_ACTIONS : LEAD_ACTIONS);
      const budget = Number(c.budget ?? 0);
      let text: string | null = null;
      let action: Record<string, unknown> | null = null;
      let buttons: Array<{ id: string; title: string }> | undefined;

      if (!isMessages && c.objective === "LEAD_GENERATION" && clicks >= 20 && results / Math.max(clicks, 1) < 0.06) {
        text =
          `📊 *${c.name}*: ${clicks} oameni au apăsat pe reclamă, dar doar ${results} au trimis formularul.\n\n` +
          "Reclama atrage (oamenii apasă), problema e ce urmează: mulți nu vor să completeze un formular. " +
          "Propun s-o refac cu butonul „Trimite mesaj”, care deschide direct chatul — aceeași poză, același text, același buget, iar pe cea veche o opresc.";
        action = { kind: "switch_to_messages", campaign_id: c.id };
        buttons = [
          { id: `perf:switch_to_messages:${c.id}`, title: "Fă schimbarea" },
          { id: `perf:ignore:${c.id}`, title: "Lasă așa" },
        ];
      } else if (spend >= budget * 1.5 && results === 0 && clicks < 10) {
        text =
          `📊 *${c.name}*: s-au cheltuit ${spend.toFixed(0)} lei și aproape nimeni n-a apăsat (${clicks} click-uri). ` +
          "De obicei e poza sau primul rând din text. Propun o poză nouă și un alt început de text, cu aceeași ofertă.";
        action = { kind: "regen_image", campaign_id: c.id };
        buttons = [
          { id: `perf:new_creative:${c.id}`, title: "Fă reclamă nouă" },
          { id: `perf:ignore:${c.id}`, title: "Lasă așa" },
        ];
      }

      if (text) {
        const r = await notifyOwner(supabaseAdmin, c.user_id, {
          text,
          holdIfClosed: true,
          kind: "perf_check",
          buttons,
          meta: { anomaly_action: action },
        });
        if ("sent" in r || "held" in r) notified++;
      }
      await supabaseAdmin
        .from("campaigns")
        .update({ creative: { ...(c.creative ?? {}), monitor: { ...monitor, [stage]: new Date().toISOString() } } })
        .eq("id", c.id);
    } catch (e) {
      console.error("[lifecycle] performance check", c.id, (e as Error).message);
    }
  }
  return { notified };
}

const TIKTOK_STALL_AFTER_MS = 12 * 60 * 60 * 1000;

/** Același ciclu pentru TikTok: afișări reale → „rulează”; respinsă → motiv; 12h fără afișări → soldul. */
async function runTikTokLifecycle(supabaseAdmin: any) {
  const since = new Date(Date.now() - WATCH_DAYS * 86400_000).toISOString();
  const { data: camps } = await supabaseAdmin
    .from("campaigns")
    .select("id, user_id, name, created_at, tiktok_campaign_id, stalled_notified_at")
    .eq("platform", "tiktok")
    .gte("created_at", since)
    .not("tiktok_campaign_id", "is", null)
    .is("live_notified_at", null)
    .is("rejected_notified_at", null);

  let checked = 0;
  let notified = 0;
  let errors = 0;
  const tt = await import("./tiktok-ads.server");
  for (const c of (camps ?? []) as any[]) {
    try {
      const tctx = await tt.getTikTokAdContext(supabaseAdmin, c.user_id);
      if (!tctx) continue;
      checked++;
      const update: Record<string, unknown> = {};
      const statuses = (await tt.getTikTokAdReviewStatus(tctx, c.tiktok_campaign_id)) ?? [];
      const rejected = statuses.find((st) => /DENY|REJECT/.test(st));
      const stats = await tt.getTikTokCampaignStats(tctx, c.tiktok_campaign_id, WATCH_DAYS);

      if (rejected) {
        update.review_state = "rejected";
        update.review_reason = rejected;
        const r = await notifyOwner(supabaseAdmin, c.user_id, {
          text: `⚠️ TikTok a respins reclama *${c.name}*${/PRIVACY/.test(rejected) ? " (din cauza politicii de confidențialitate de pe pagină)" : ""}.\n\nScrie-mi aici și o refacem împreună.`,
          holdIfClosed: true,
          kind: "ad_rejected",
        });
        if ("sent" in r || "held" in r) {
          update.rejected_notified_at = new Date().toISOString();
          notified++;
        }
      } else if (stats.impressions > 0) {
        update.review_state = "delivering";
        const r = await notifyOwner(supabaseAdmin, c.user_id, {
          text: `✅ TikTok a aprobat reclama *${c.name}* și a început să ruleze (${stats.impressions} afișări până acum).\n\nÎți scriu imediat ce vine primul client.`,
          holdIfClosed: true,
          kind: "ad_live",
        });
        if ("sent" in r || "held" in r) {
          update.live_notified_at = new Date().toISOString();
          notified++;
        }
      } else {
        update.review_state = statuses.some((st) => /AUDIT/.test(st)) ? "in_review" : (statuses[0] ?? "pending").toLowerCase();
        const age = Date.now() - new Date(c.created_at).getTime();
        if (age > TIKTOK_STALL_AFTER_MS && !c.stalled_notified_at && !statuses.some((st) => /AUDIT/.test(st))) {
          const r = await notifyOwner(supabaseAdmin, c.user_id, {
            text: `ℹ️ Reclama TikTok *${c.name}* încă nu are afișări. Cel mai des, contul de reclame TikTok nu are sold sau metodă de plată: verifică în TikTok Ads Manager → Payment. Dacă totul e în regulă acolo, scrie-mi și mă uit împreună cu tine.`,
            holdIfClosed: true,
            kind: "ad_stalled",
          });
          if ("sent" in r || "held" in r) {
            update.stalled_notified_at = new Date().toISOString();
            notified++;
          }
        }
      }
      await supabaseAdmin.from("campaigns").update(update).eq("id", c.id);
    } catch (e) {
      errors++;
      console.error("[lifecycle] tiktok campaign", c.id, (e as Error).message);
    }
  }
  return { checked, notified, errors };
}
