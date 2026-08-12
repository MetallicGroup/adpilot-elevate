import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GOAL_IDS } from "@/lib/goals";

const ObjectiveSchema = z.enum(["bookings", "leads", "calls"]);

const CopySchema = z.object({
  headline: z.string().min(3).max(160),
  subheadline: z.string().min(3).max(300),
  offer_label: z.string().max(120).default(""),
  benefits: z.array(z.string().max(160)).max(8).default([]),
  about: z.string().max(900).default(""),
  faq: z.array(z.object({ q: z.string().max(200), a: z.string().max(600) })).max(6).default([]),
  cta_label: z.string().max(60).default("Trimite"),
  trust_points: z.array(z.string().max(80)).max(6).default([]),
});

const QuestionSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(2).max(160),
  type: z.string().min(2).max(20),
  options: z.array(z.string().max(80)).max(10).default([]),
  required: z.boolean().default(false),
  position: z.number().int().min(0).max(20).default(0),
  source: z.enum(["preset", "ai", "user"]).default("ai"),
});

const DraftSchema = z.object({
  objective: ObjectiveSchema,
  business_name: z.string().min(2).max(120),
  service: z.string().min(2).max(160),
  city: z.string().max(120).nullable().optional(),
  offer: z.string().max(300).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  copy: CopySchema,
  questions: z.array(QuestionSchema).max(8).default([]),
});

export const saveOnboardingGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ goal: z.enum(GOAL_IDS as [string, ...string[]]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("profiles")
      .update({ onboarding_goal: data.goal })
      .eq("id", context.userId);
    return { ok: true };
  });

export const getGoalSetupState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: profile }, { data: biz }, { data: pages }] = await Promise.all([
      context.supabase.from("profiles").select("onboarding_goal, full_name").eq("id", context.userId).maybeSingle(),
      context.supabase
        .from("business_profiles")
        .select("name, city, phone")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase.from("meta_pages").select("page_id, page_name").eq("user_id", context.userId).limit(5),
    ]);

    const { data: existing } = await context.supabase
      .from("booking_campaigns")
      .select("slug, objective, status")
      .eq("user_id", context.userId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      goal: (profile?.onboarding_goal as string | null) ?? null,
      business: biz ?? null,
      pages: pages ?? [],
      existing_page: existing ?? null,
    };
  });

export const detectMetaPixels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { detectPixelsCore } = await import("./goal-setup.server");
    return detectPixelsCore(context.userId);
  });

export const buildLandingDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        objective: ObjectiveSchema,
        business_name: z.string().min(2).max(120),
        service: z.string().min(2).max(160),
        city: z.string().max(120).nullable().optional(),
        offer: z.string().max(300).nullable().optional(),
        phone: z.string().max(40).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { buildLandingDraftCore } = await import("./goal-setup.server");
    return buildLandingDraftCore(context.userId, data);
  });

export const regenerateLandingPart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        objective: ObjectiveSchema,
        section: z.enum(["headline", "subheadline", "benefits", "about"]),
        business_name: z.string().min(2).max(120),
        service: z.string().min(2).max(160),
        city: z.string().max(120).nullable().optional(),
        copy: CopySchema,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { regenerateLandingSection } = await import("@/lib/booking/ai.server");
    return regenerateLandingSection({
      objective: data.objective,
      section: data.section,
      current: data.copy as never,
      businessName: data.business_name,
      service: data.service,
      city: data.city ?? null,
    });
  });

export const publishLandingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DraftSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { saveLandingCore } = await import("./goal-setup.server");
    return saveLandingCore(context.userId, data as never);
  });
