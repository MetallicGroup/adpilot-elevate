/**
 * Incremental Meta Lead Ads sync.
 *
 * Runs without `pages_manage_metadata`: instead of relying on the page-level
 * `leadgen` webhook, we poll `/{form_id}/leads` with `leads_retrieval` every
 * few minutes and only fetch leads newer than the last processed one.
 *
 * Dedupe is guaranteed by the unique index on (platform, external_lead_id).
 */
import { metaApiVersion } from "./meta.server";
import { mapMetaLeadFields } from "./leads.server";

export type SyncResult = {
  inserted: number;
  scanned: number;
  forms: number;
  pages: number;
  errors: string[];
};

/** Overlap window so leads created during the previous run are not skipped. */
const OVERLAP_MS = 10 * 60 * 1000;

export async function syncMetaLeadsForUser(
  userId: string,
  opts: { full?: boolean } = {},
): Promise<SyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const v = metaApiVersion();
  const result: SyncResult = { inserted: 0, scanned: 0, forms: 0, pages: 0, errors: [] };

  const { data: pages } = await supabaseAdmin
    .from("meta_pages")
    .select("id, page_id, page_access_token, last_lead_created_at")
    .eq("user_id", userId)
    .eq("is_active", true);
  if (!pages?.length) return result;

  // Notificare WhatsApp la lead NOU: central number → telefonul userului.
  // Doar pentru lead-uri proaspete (fereastră), ca să nu-l inundăm la un backfill.
  const { getCentralWhatsApp, sendWhatsAppMessage } = await import("./whatsapp.server");
  const central = getCentralWhatsApp();
  const { data: waConn } = await supabaseAdmin
    .from("whatsapp_connections")
    .select("id, user_phone")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const notifyPhone =
    central && waConn?.user_phone ? waConn.user_phone.replace(/\D/g, "") : null;
  const LEAD_FRESH_MS = 3 * 60 * 60 * 1000;

  for (const p of pages) {
    if (!p.page_access_token) continue;
    result.pages++;

    // Only ask Meta for leads newer than the last one we stored (minus overlap).
    let sinceUnix: number | null = null;
    if (!opts.full && p.last_lead_created_at) {
      sinceUnix = Math.floor((new Date(p.last_lead_created_at).getTime() - OVERLAP_MS) / 1000);
    }

    let newestForPage: string | null = p.last_lead_created_at ?? null;

    try {
      const formsRes = await fetch(
        `https://graph.facebook.com/${v}/${p.page_id}/leadgen_forms?fields=id,name&limit=200&access_token=${encodeURIComponent(p.page_access_token)}`,
      );
      const formsJson: any = await formsRes.json();
      if (!formsRes.ok) {
        result.errors.push(`page ${p.page_id}: ${formsJson?.error?.message ?? formsRes.status}`);
        continue;
      }
      const formList: Array<{ id: string; name: string }> = formsJson?.data ?? [];
      result.forms += formList.length;

      for (const form of formList) {
        const url = new URL(`https://graph.facebook.com/${v}/${form.id}/leads`);
        url.searchParams.set("fields", "id,created_time,ad_id,form_id,field_data");
        url.searchParams.set("limit", "100");
        url.searchParams.set("access_token", p.page_access_token);
        if (sinceUnix) {
          url.searchParams.set(
            "filtering",
            JSON.stringify([
              { field: "time_created", operator: "GREATER_THAN", value: sinceUnix },
            ]),
          );
        }

        let next: string | null = url.toString();
        while (next) {
          const r = await fetch(next);
          const j: any = await r.json();
          if (!r.ok) {
            const msg = j?.error?.message ?? `HTTP ${r.status}`;
            console.error("[leads-sync] form", form.id, msg);
            result.errors.push(`${form.id}: ${msg}`);
            break;
          }
          const rows: any[] = j?.data ?? [];
          for (const row of rows) {
            result.scanned++;
            if (row.created_time && (!newestForPage || row.created_time > newestForPage)) {
              newestForPage = row.created_time;
            }

            let campaign_id: string | null = null;
            let campaignName: string | null = null;
            if (row.ad_id) {
              const { data: camp } = await supabaseAdmin
                .from("campaigns")
                .select("id, name")
                .eq("user_id", userId)
                .eq("meta_ad_id", row.ad_id)
                .maybeSingle();
              campaign_id = camp?.id ?? null;
              campaignName = camp?.name ?? null;
            }

            const mapped = mapMetaLeadFields(row.field_data || []);
            // Unique index on (platform, external_lead_id) makes this idempotent.
            const { error: insErr } = await supabaseAdmin.from("leads").insert({
              user_id: userId,
              platform: "meta" as const,
              campaign_id,
              external_lead_id: row.id,
              external_form_id: form.id,
              external_ad_id: row.ad_id ?? null,
              full_name: mapped.full_name,
              email: mapped.email,
              phone: mapped.phone,
              message: mapped.message,
              raw: row as any,
              status: "new" as const,
              created_at: row.created_time ?? new Date().toISOString(),
            });
            if (insErr) {
              // 23505 = duplicate → lead already stored (webhook or earlier run).
              if (insErr.code !== "23505") {
                console.error("[leads-sync] insert", row.id, insErr.message);
                result.errors.push(`insert ${row.id}: ${insErr.message}`);
              }
            } else {
              result.inserted++;
              // Notifică userul pe WhatsApp — doar lead-uri proaspete (nu backfill vechi).
              const createdMs = row.created_time
                ? new Date(row.created_time).getTime()
                : Date.now();
              if (notifyPhone && central && Date.now() - createdMs < LEAD_FRESH_MS) {
                const lines = [
                  "🎯 *Lead nou!*",
                  mapped.full_name ? `👤 *${mapped.full_name}*` : "",
                  mapped.phone ? `📞 ${mapped.phone}` : "",
                  mapped.email ? `✉️ ${mapped.email}` : "",
                  mapped.message ? `💬 ${mapped.message}` : "",
                  campaignName ? `📣 _${campaignName}_` : "",
                  "",
                  "Scrie-mi *lead-uri* ca să le vezi pe toate. 📋",
                ]
                  .filter(Boolean)
                  .join("\n");
                try {
                  const { id: waId } = await sendWhatsAppMessage(
                    central.phoneNumberId,
                    central.accessToken,
                    notifyPhone,
                    { type: "text", text: lines },
                  );
                  await supabaseAdmin.from("whatsapp_messages").insert({
                    user_id: userId,
                    connection_id: waConn?.id ?? null,
                    wa_message_id: waId,
                    direction: "out",
                    msg_type: "text",
                    text: lines,
                    meta: { kind: "lead_notify" },
                  });
                } catch (e) {
                  console.error("[leads-sync] lead notify failed", e);
                }
              }
            }
          }
          next = j?.paging?.next ?? null;
        }
      }
    } catch (e) {
      result.errors.push(`page ${p.page_id}: ${(e as Error).message}`);
    }

    await supabaseAdmin
      .from("meta_pages")
      .update({
        leads_synced_at: new Date().toISOString(),
        last_lead_created_at: newestForPage,
      })
      .eq("id", p.id);
  }

  return result;
}

/** Cron entry point: incremental sync for every user with active pages. */
export async function syncAllMetaLeads(): Promise<{
  users: number;
  inserted: number;
  errors: string[];
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows } = await supabaseAdmin
    .from("meta_pages")
    .select("user_id")
    .eq("is_active", true);
  const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));

  let inserted = 0;
  const errors: string[] = [];
  for (const userId of userIds) {
    try {
      const res = await syncMetaLeadsForUser(userId);
      inserted += res.inserted;
      errors.push(...res.errors.slice(0, 3));
    } catch (e) {
      errors.push(`${userId}: ${(e as Error).message}`);
    }
  }
  return { users: userIds.length, inserted, errors: errors.slice(0, 20) };
}
