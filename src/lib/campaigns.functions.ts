import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CampaignSchema = z.object({
  platform: z.enum(["tiktok", "meta"]).default("tiktok"),
  name: z.string().trim().min(1).max(120),
  objective: z.enum(["LEAD_GENERATION", "CONVERSIONS"]),
  budget: z.number().min(5).max(1000000),
  budget_mode: z.enum(["BUDGET_MODE_DAY", "BUDGET_MODE_TOTAL"]),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  targeting: z.object({
    locations: z.array(z.string()).max(50),
    age_groups: z.array(z.string()).max(10),
    genders: z.array(z.string()).max(3),
    interests: z.array(z.string()).max(50),
    languages: z.array(z.string()).max(20),
  }),
  creative: z.object({
    headline: z.string().trim().max(80).default(""),
    description: z.string().trim().max(280).default(""),
    cta: z.string().trim().max(40).default("Learn More"),
    media_url: z.string().trim().max(2000).default(""),
    landing_url: z.string().trim().max(2000).default(""),
  }),
  lead_form: z
    .object({
      title: z.string().trim().max(120).default(""),
      intro: z.string().trim().max(500).default(""),
      fields: z.array(z.string()).max(15),
      custom_questions: z.array(z.string().trim().max(200)).max(15).default([]),
      privacy_url: z.string().trim().max(2000).default(""),
    })
    .nullable(),
  status: z.enum(["draft", "active", "paused"]).default("draft"),
});

export const saveCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CampaignSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("campaigns")
      .insert({
        user_id: userId,
        platform: data.platform,
        name: data.name,
        objective: data.objective,
        budget: data.budget,
        budget_mode: data.budget_mode,
        start_date: data.start_date,
        end_date: data.end_date,
        targeting: data.targeting,
        creative: data.creative,
        lead_form: data.lead_form,
        status: data.status,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export type CampaignListRow = {
  id: string;
  name: string;
  platform: "tiktok" | "meta";
  status: string;
  objective: string;
  budget: number;
  budget_mode: string;
  created_at: string;
  meta_campaign_id: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
};

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select(
        "id, name, platform, status, objective, budget, budget_mode, created_at, meta_campaign_id",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const ids = (campaigns ?? []).map((c) => c.id);
    let perfByCampaign: Record<string, { spend: number; impressions: number; clicks: number; leads: number }> = {};
    if (ids.length) {
      const { data: perf } = await supabase
        .from("performance_data")
        .select("campaign_id, spend, impressions, clicks, leads")
        .in("campaign_id", ids);
      for (const p of perf ?? []) {
        const k = p.campaign_id as string;
        const acc = perfByCampaign[k] ?? { spend: 0, impressions: 0, clicks: 0, leads: 0 };
        acc.spend += Number(p.spend ?? 0);
        acc.impressions += Number(p.impressions ?? 0);
        acc.clicks += Number(p.clicks ?? 0);
        acc.leads += Number(p.leads ?? 0);
        perfByCampaign[k] = acc;
      }
    }

    const rows: CampaignListRow[] = (campaigns ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      status: c.status,
      objective: c.objective,
      budget: Number(c.budget),
      budget_mode: c.budget_mode,
      created_at: c.created_at,
      meta_campaign_id: c.meta_campaign_id,
      ...(perfByCampaign[c.id] ?? { spend: 0, impressions: 0, clicks: 0, leads: 0 }),
    }));
    return { campaigns: rows };
  });

const IdInput = z.object({ id: z.string().uuid() });

export const getCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!campaign) throw new Error("Campaign not found");

    const { data: perf } = await supabase
      .from("performance_data")
      .select("date, spend, impressions, clicks, ctr, leads, cpl")
      .eq("campaign_id", data.id)
      .order("date", { ascending: false })
      .limit(30);

    const { data: insights } = await supabase
      .from("ai_insights")
      .select("id, insight_text, action, generated_at")
      .eq("campaign_id", data.id)
      .order("generated_at", { ascending: false })
      .limit(20);

    const totals = (perf ?? []).reduce(
      (acc, p) => ({
        spend: acc.spend + Number(p.spend ?? 0),
        impressions: acc.impressions + Number(p.impressions ?? 0),
        clicks: acc.clicks + Number(p.clicks ?? 0),
        leads: acc.leads + Number(p.leads ?? 0),
      }),
      { spend: 0, impressions: 0, clicks: 0, leads: 0 },
    );

    return { campaign, perf: perf ?? [], insights: insights ?? [], totals };
  });