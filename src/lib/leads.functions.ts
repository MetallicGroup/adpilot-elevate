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