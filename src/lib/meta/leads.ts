import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { upsertCrmLead } from "@/lib/crm/leads.service";
import { notifyNewLead } from "@/lib/whatsapp/notifications";
import { metaGraphRequest } from "./client";
import { getMetaAccessToken } from "./oauth";
import type { MetaLeadRow } from "./types";

type LeadgenFormLeadsResponse = {
  data: Array<{
    id: string;
    created_time: string;
    field_data?: Array<{ name: string; values: string[] }>;
  }>;
};

function parseFieldData(fieldData?: Array<{ name: string; values: string[] }>) {
  const result: {
    name?: string;
    email?: string;
    phone?: string;
    raw: Record<string, string>;
    custom: Record<string, string>;
  } = { raw: {}, custom: {} };

  for (const field of fieldData ?? []) {
    const value = field.values?.[0] ?? "";
    const key = field.name.toLowerCase();
    result.raw[field.name] = value;

    if (key.includes("email")) result.email = value;
    else if (key.includes("phone") || key.includes("telefon")) result.phone = value;
    else if (key.includes("full_name") || key === "name" || key.includes("nume")) result.name = value;
    else result.custom[field.name] = value;
  }

  return result;
}

export async function syncMetaLeads(userId: string, campaignUuid?: string) {
  const token = await getMetaAccessToken(userId);

  let query = supabaseAdmin
    .from("meta_campaigns")
    .select("id, meta_form_id, campaign_name")
    .eq("user_id", userId)
    .not("meta_form_id", "is", null);

  if (campaignUuid) {
    query = query.eq("id", campaignUuid);
  }

  const { data: campaigns, error } = await query;
  if (error) throw new Error(error.message);
  if (!campaigns?.length) return { synced: 0 };

  let synced = 0;

  for (const campaign of campaigns) {
    if (!campaign.meta_form_id) continue;

    const leads = await metaGraphRequest<LeadgenFormLeadsResponse>(`/${campaign.meta_form_id}/leads`, {
      accessToken: token,
      body: { fields: "id,created_time,field_data", limit: "100" },
    });

    for (const lead of leads.data ?? []) {
      const parsed = parseFieldData(lead.field_data);
      const { error: upsertError } = await supabaseAdmin.from("meta_leads").upsert(
        {
          user_id: userId,
          campaign_id: campaign.id,
          platform_lead_id: lead.id,
          name: parsed.name ?? null,
          email: parsed.email ?? null,
          phone: parsed.phone ?? null,
          raw_payload: { ...parsed.raw, created_time: lead.created_time },
        },
        { onConflict: "user_id,platform_lead_id" },
      );

      if (!upsertError) {
        synced++;
        const crm = await upsertCrmLead({
          userId,
          platform: "meta",
          platformLeadId: lead.id,
          campaignId: campaign.id,
          campaignName: campaign.campaign_name,
          name: parsed.name,
          phone: parsed.phone,
          email: parsed.email,
          customAnswers: parsed.custom,
          rawPayload: { ...parsed.raw, created_time: lead.created_time },
        });

        if (crm.isNew) {
          await notifyNewLead(userId, {
            platform: "Meta",
            campaignName: campaign.campaign_name ?? "Campanie",
            name: parsed.name ?? "Necunoscut",
            phone: parsed.phone ?? "—",
            service: parsed.custom["Serviciu dorit"] ?? parsed.custom["service"] ?? "—",
            preferredDate: parsed.custom["Data preferată"] ?? parsed.custom["preferred_date"] ?? "—",
            leadId: crm.id,
          });
        }
      }
    }
  }

  return { synced };
}

export async function listMetaLeads(userId: string): Promise<MetaLeadRow[]> {
  const { data, error } = await supabaseAdmin
    .from("meta_leads")
    .select("id, campaign_id, platform_lead_id, name, email, phone, created_at, meta_campaigns(campaign_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    campaign_id: row.campaign_id,
    platform_lead_id: row.platform_lead_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    created_at: row.created_at,
    campaign_name: (row.meta_campaigns as { campaign_name: string } | null)?.campaign_name ?? null,
  }));
}
