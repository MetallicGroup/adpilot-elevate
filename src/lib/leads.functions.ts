import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "appointment_scheduled",
  "won",
  "lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type LeadRow = {
  id: string;
  platform: "tiktok" | "meta";
  campaign_id: string | null;
  campaign_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  status: LeadStatus;
  notes: string | null;
  source_url: string | null;
  created_at: string;
};

const ListInput = z.object({
  platform: z.enum(["all", "tiktok", "meta"]).default("all"),
  status: z.enum(["all", ...LEAD_STATUSES]).default("all"),
  campaign_id: z.string().nullable().default(null),
  search: z.string().trim().max(120).default(""),
  since_days: z.number().int().min(0).max(365).nullable().default(null),
});

export const listLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("leads")
      .select(
        "id, platform, campaign_id, full_name, email, phone, message, status, notes, source_url, created_at, campaigns(name)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (data.platform !== "all") q = q.eq("platform", data.platform);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.campaign_id) q = q.eq("campaign_id", data.campaign_id);
    if (data.since_days && data.since_days > 0) {
      const since = new Date(Date.now() - data.since_days * 24 * 60 * 60 * 1000).toISOString();
      q = q.gte("created_at", since);
    }
    if (data.search) {
      const s = `%${data.search.replace(/[%_]/g, "")}%`;
      q = q.or(`full_name.ilike.${s},email.ilike.${s},phone.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const leads: LeadRow[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      platform: r.platform,
      campaign_id: r.campaign_id,
      campaign_name: r.campaigns?.name ?? null,
      full_name: r.full_name,
      email: r.email,
      phone: r.phone,
      message: r.message,
      status: r.status,
      notes: r.notes,
      source_url: r.source_url,
      created_at: r.created_at,
    }));

    // Also fetch campaign list for filter dropdown
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id, name, platform")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);

    return { leads, campaigns: campaigns ?? [] };
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  status: z.enum(LEAD_STATUSES).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    const patch: { status?: LeadStatus; notes?: string } = {};
    if (data.status) patch.status = data.status;
    if (typeof data.notes === "string") patch.notes = data.notes;
    const { error } = await context.supabase
      .from("leads")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const BulkInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  action: z.enum(["status", "delete"]),
  status: z.enum(LEAD_STATUSES).optional(),
});

export const bulkLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BulkInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.action === "delete") {
      const { error } = await supabase.from("leads").delete().in("id", data.ids).eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else if (data.action === "status" && data.status) {
      const { error } = await supabase.from("leads").update({ status: data.status }).in("id", data.ids).eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true, count: data.ids.length };
  });

/** Used by wizard to verify Meta connection before publish */
export const checkMetaReady = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: conn } = await context.supabase
      .from("meta_connections")
      .select("id, is_active")
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!conn) return { ready: false, reason: "no_connection" as const };
    const { data: pages } = await context.supabase
      .from("meta_pages")
      .select("id")
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .limit(1);
    if (!pages || pages.length === 0) return { ready: false, reason: "no_pages" as const };
    return { ready: true as const };
  });

/** Lists active Facebook Pages the user has connected, used in the wizard for page selection */
export const listMetaPages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("meta_pages")
      .select("page_id, page_name")
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .order("page_name", { ascending: true });
    if (error) throw new Error(error.message);
    return { pages: (data ?? []) as { page_id: string; page_name: string }[] };
  });

/**
 * Pull all leads from every Meta Lead Ads form on each connected Page and
 * upsert them into the `leads` table. Used as a fallback when the page-level
 * webhook subscription is missing or has not fired.
 */
export const syncMetaLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as Record<string, never>)
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { metaApiVersion } = await import("@/lib/meta.server");
    const { mapMetaLeadFields } = await import("@/lib/leads.server");
    const v = metaApiVersion();

    const { data: pages } = await supabaseAdmin
      .from("meta_pages")
      .select("page_id, page_access_token")
      .eq("user_id", userId)
      .eq("is_active", true);
    if (!pages?.length) return { inserted: 0, scanned: 0, forms: 0 };

    let inserted = 0;
    let scanned = 0;
    let forms = 0;
    const errors: string[] = [];

    for (const p of pages) {
      if (!p.page_access_token) continue;
      const formsRes = await fetch(
        `https://graph.facebook.com/${v}/${p.page_id}/leadgen_forms?fields=id,name&limit=200&access_token=${encodeURIComponent(p.page_access_token)}`,
      );
      const formsJson = await formsRes.json();
      const formList: Array<{ id: string; name: string }> = formsJson?.data ?? [];
      forms += formList.length;

      for (const form of formList) {
        let next: string | null =
          `https://graph.facebook.com/${v}/${form.id}/leads?fields=id,created_time,ad_id,form_id,field_data&limit=100&access_token=${encodeURIComponent(p.page_access_token)}`;
        while (next) {
          const r = await fetch(next);
          const j: any = await r.json();
          if (!r.ok) {
            const msg = j?.error?.message ?? `HTTP ${r.status}`;
            console.error("[syncMetaLeads] form", form.id, msg);
            errors.push(`${form.id}: ${msg}`);
            break;
          }
          const rows: any[] = j?.data ?? [];
          for (const row of rows) {
            scanned++;
            const mapped = mapMetaLeadFields(row.field_data || []);
            let campaign_id: string | null = null;
            if (row.ad_id) {
              const { data: camp } = await supabaseAdmin
                .from("campaigns")
                .select("id")
                .eq("user_id", userId)
                .eq("meta_ad_id", row.ad_id)
                .maybeSingle();
              campaign_id = camp?.id ?? null;
            }
            // Check if lead already exists, then insert.
            const { data: existing } = await supabaseAdmin
              .from("leads")
              .select("id")
              .eq("platform", "meta")
              .eq("external_lead_id", row.id)
              .maybeSingle();
            if (existing) continue;
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
              console.error("[syncMetaLeads] insert", row.id, insErr.message);
              errors.push(`insert ${row.id}: ${insErr.message}`);
            } else {
              inserted++;
            }
          }
          next = j?.paging?.next ?? null;
        }
      }
    }
    return { inserted, scanned, forms, errors };
  });