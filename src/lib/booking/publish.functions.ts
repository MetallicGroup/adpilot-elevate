import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PublishSchema = z.object({
  booking_campaign_id: z.string().uuid(),
  ad_account_uuid: z.string().uuid(),
  page_id: z.string().min(1).max(60),
  daily_budget: z.number().min(20).max(100000),
  duration_days: z.number().int().min(1).max(365).default(30),
  city: z.string().max(120).nullable().optional(),
  radius_km: z.number().min(5).max(80).default(20),
  age_min: z.number().int().min(18).max(65).default(25),
  age_max: z.number().int().min(18).max(65).default(55),
  genders: z.array(z.number().int()).max(2).default([]),
  hero_image_url: z.string().max(1000),
  primary_text: z.string().min(10).max(1000),
  headline: z.string().min(3).max(120),
  description: z.string().max(200).default(""),
  launch_active: z.boolean().default(true),
});

export const publishBookingCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PublishSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { publishBookingCampaignCore } = await import("./publish.server");
    return publishBookingCampaignCore(context.userId, data);
  });

export const unpublishBookingCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ booking_campaign_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Oprește și reclama pe Meta — altfel landing-ul dă „indisponibil” dar
    // reclama continuă să ducă trafic plătit spre o pagină moartă.
    const { data: page } = await context.supabase
      .from("booking_campaigns")
      .select("campaign_id")
      .eq("id", data.booking_campaign_id)
      .maybeSingle();
    if (page?.campaign_id) {
      const { setMetaCampaignStatus } = await import("@/lib/campaign-control.server");
      await setMetaCampaignStatus({
        userId: context.userId,
        campaignId: page.campaign_id,
        next: "PAUSED",
      }).catch(() => {});
    }
    const { error } = await context.supabase
      .from("booking_campaigns")
      .update({ status: "paused" })
      .eq("id", data.booking_campaign_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });