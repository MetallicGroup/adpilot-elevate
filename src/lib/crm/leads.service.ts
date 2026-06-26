// @ts-nocheck
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { LeadStatus } from "@/lib/launcher/types";

export type CrmLead = {
  id: string;
  platform: string;
  campaign_id: string | null;
  campaign_name: string | null;
  ad_account_id: string | null;
  platform_lead_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  custom_answers: Record<string, string>;
  status: LeadStatus;
  notes: string | null;
  last_activity_at: string;
  created_at: string;
};

export async function upsertCrmLead(input: {
  userId: string;
  platform: "meta" | "tiktok";
  platformLeadId: string;
  campaignId?: string | null;
  campaignName?: string | null;
  adAccountId?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  customAnswers?: Record<string, string>;
  rawPayload?: Record<string, unknown>;
}) {
  const { data: existing } = await supabaseAdmin
    .from("leads_crm")
    .select("id")
    .eq("user_id", input.userId)
    .eq("platform", input.platform)
    .eq("platform_lead_id", input.platformLeadId)
    .maybeSingle();

  const row = {
    user_id: input.userId,
    platform: input.platform,
    platform_lead_id: input.platformLeadId,
    campaign_id: input.campaignId ?? null,
    campaign_name: input.campaignName ?? null,
    ad_account_id: input.adAccountId ?? null,
    name: input.name ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    custom_answers: input.customAnswers ?? {},
    raw_payload: input.rawPayload ?? {},
    last_activity_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("leads_crm")
      .update(row)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: data.id as string, isNew: false };
  }

  const { data, error } = await supabaseAdmin
    .from("leads_crm")
    .insert({ ...row, status: "new" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("lead_timeline").insert({
    lead_id: data.id,
    user_id: input.userId,
    event_type: "created",
    description: `Lead nou de pe ${input.platform === "meta" ? "Meta" : "TikTok"}`,
  });

  return { id: data.id as string, isNew: true };
}

export async function listCrmLeads(
  userId: string,
  filters?: { status?: LeadStatus; platform?: string; search?: string },
) {
  let query = supabaseAdmin
    .from("leads_crm")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.platform) query = query.eq("platform", filters.platform);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let leads = (data ?? []) as CrmLead[];

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    leads = leads.filter(
      (l) =>
        l.name?.toLowerCase().includes(q) ||
        l.phone?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.campaign_name?.toLowerCase().includes(q),
    );
  }

  return leads;
}

export async function updateLeadStatus(userId: string, leadId: string, status: LeadStatus) {
  const { error } = await supabaseAdmin
    .from("leads_crm")
    .update({ status, last_activity_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("lead_timeline").insert({
    lead_id: leadId,
    user_id: userId,
    event_type: "status_change",
    description: `Status schimbat în: ${status}`,
  });
}

export async function updateLeadNotes(userId: string, leadId: string, notes: string) {
  const { error } = await supabaseAdmin
    .from("leads_crm")
    .update({ notes, last_activity_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("lead_timeline").insert({
    lead_id: leadId,
    user_id: userId,
    event_type: "note",
    description: "Notă actualizată",
  });
}

export async function getLeadTimeline(userId: string, leadId: string) {
  const { data, error } = await supabaseAdmin
    .from("lead_timeline")
    .select("id, event_type, description, created_at")
    .eq("user_id", userId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function leadsToCsv(leads: CrmLead[]): string {
  const headers = ["Platformă", "Campanie", "Nume", "Telefon", "Email", "Status", "Creat", "Răspunsuri"];
  const rows = leads.map((l) => [
    l.platform,
    l.campaign_name ?? "",
    l.name ?? "",
    l.phone ?? "",
    l.email ?? "",
    l.status,
    l.created_at,
    JSON.stringify(l.custom_answers),
  ]);
  return [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}