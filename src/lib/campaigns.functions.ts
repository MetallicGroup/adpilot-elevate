import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CampaignSchema = z.object({
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