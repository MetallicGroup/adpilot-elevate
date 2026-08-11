import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BOOKING_QUESTION_TYPES } from "./types";
import type { BookingQuestion, LandingCopy } from "./types";
import { DEFAULT_AVAILABILITY } from "./availability";

const QuestionSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(2).max(160),
  type: z.enum(BOOKING_QUESTION_TYPES as [string, ...string[]]),
  options: z.array(z.string().max(80)).max(10).default([]),
  required: z.boolean().default(false),
  help_text: z.string().max(200).nullable().optional(),
  position: z.number().int().min(0).max(50),
  source: z.enum(["preset", "ai", "user"]).default("user"),
});

const ServiceSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(300).nullable().optional(),
  duration_min: z.number().int().min(10).max(600).default(60),
  price: z.number().min(0).max(1_000_000).nullable().optional(),
  position: z.number().int().min(0).max(50).default(0),
});

const AvailabilitySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  slot_min: z.number().int().min(10).max(240).default(30),
  buffer_min: z.number().int().min(0).max(120).default(0),
});

const BusinessSchema = z.object({
  name: z.string().min(2).max(120),
  niche: z.string().min(2).max(40),
  niche_custom: z.string().max(120).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  address: z.string().max(240).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().max(160).nullable().optional(),
  website: z.string().max(240).nullable().optional(),
  logo_url: z.string().max(1000).nullable().optional(),
  description: z.string().max(1500).nullable().optional(),
  privacy_policy_url: z.string().max(500).nullable().optional(),
});

function slugify(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export const getBusinessProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data ?? null;
  });

export const saveBusinessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BusinessSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("business_profiles")
      .upsert({ ...data, user_id: context.userId }, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const { count } = await context.supabase
      .from("booking_availability")
      .select("id", { count: "exact", head: true })
      .eq("business_id", row.id);
    if (!count) {
      await context.supabase.from("booking_availability").insert(
        DEFAULT_AVAILABILITY.map((r) => ({ ...r, business_id: row.id, user_id: context.userId })),
      );
    }
    return row;
  });

export const classifyBusinessNiche = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().min(2).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { classifyNiche } = await import("./ai.server");
    return { niche: await classifyNiche(data.text) };
  });

export const suggestBookingQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ service: z.string().min(2).max(160), offer: z.string().max(300).nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: biz } = await context.supabase
      .from("business_profiles")
      .select("name, niche, niche_custom, city")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!biz) throw new Error("Completează întâi profilul afacerii.");
    const { generateBookingQuestions } = await import("./ai.server");
    const questions = await generateBookingQuestions({
      niche: biz.niche as never,
      nicheCustom: biz.niche_custom,
      businessName: biz.name,
      city: biz.city,
      service: data.service,
      offer: data.offer ?? null,
    });
    return { questions };
  });

export const createBookingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        service: z.string().min(2).max(160),
        offer: z.string().max(300).nullable().optional(),
        questions: z.array(QuestionSchema).max(8),
        services: z.array(ServiceSchema).min(1).max(12),
        availability: z.array(AvailabilitySchema).max(7).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: biz } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!biz) throw new Error("Completează întâi profilul afacerii.");

    const base = `${slugify(biz.name)}-${slugify(data.service)}`.slice(0, 60);
    let slug = base;
    for (let i = 2; i < 30; i++) {
      const { data: taken } = await supabase.from("booking_campaigns").select("id").eq("slug", slug).maybeSingle();
      if (!taken) break;
      slug = `${base}-${i}`;
    }

    const { generateLandingCopy } = await import("./ai.server");
    const landing: LandingCopy = await generateLandingCopy({
      niche: biz.niche as never,
      nicheCustom: biz.niche_custom,
      businessName: biz.name,
      city: biz.city,
      service: data.service,
      offer: data.offer ?? null,
      description: biz.description,
    });

    const { data: page, error } = await supabase
      .from("booking_campaigns")
      .insert({
        user_id: context.userId,
        business_id: biz.id,
        slug,
        service: data.service,
        offer: data.offer ?? null,
        status: "draft",
        landing_copy: landing as never,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (data.questions.length) {
      const { error: qErr } = await supabase.from("booking_questions").insert(
        data.questions.map((q, i) => ({
          ...q,
          position: i,
          user_id: context.userId,
          booking_campaign_id: page.id,
        })),
      );
      if (qErr) throw new Error(qErr.message);
    }

    const { error: sErr } = await supabase.from("booking_services").insert(
      data.services.map((s, i) => ({
        ...s,
        position: i,
        user_id: context.userId,
        booking_campaign_id: page.id,
      })),
    );
    if (sErr) throw new Error(sErr.message);

    if (data.availability?.length) {
      await supabase.from("booking_availability").upsert(
        data.availability.map((a) => ({ ...a, business_id: biz.id, user_id: context.userId })),
        { onConflict: "business_id,weekday" },
      );
    }

    return { id: page.id as string, slug: page.slug as string, landing_copy: landing };
  });

export const getBookingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: page } = await supabase.from("booking_campaigns").select("*").eq("id", data.id).maybeSingle();
    if (!page) throw new Error("Pagina de programare nu există.");
    const [{ data: questions }, { data: services }, { data: availability }] = await Promise.all([
      supabase.from("booking_questions").select("*").eq("booking_campaign_id", page.id).order("position"),
      supabase.from("booking_services").select("*").eq("booking_campaign_id", page.id).order("position"),
      supabase.from("booking_availability").select("*").eq("business_id", page.business_id).order("weekday"),
    ]);
    return { page, questions: questions ?? [], services: services ?? [], availability: availability ?? [] };
  });

export const updateBookingQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ booking_campaign_id: z.string().uuid(), questions: z.array(QuestionSchema).max(8) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    await supabase.from("booking_questions").delete().eq("booking_campaign_id", data.booking_campaign_id);
    if (data.questions.length) {
      const { error } = await supabase.from("booking_questions").insert(
        data.questions.map((q, i) => ({
          ...q,
          position: i,
          user_id: context.userId,
          booking_campaign_id: data.booking_campaign_id,
        })),
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const saveAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ availability: z.array(AvailabilitySchema).max(7) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: biz } = await context.supabase
      .from("business_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!biz) throw new Error("Completează întâi profilul afacerii.");
    await context.supabase.from("booking_availability").delete().eq("business_id", biz.id);
    if (data.availability.length) {
      const { error } = await context.supabase.from("booking_availability").insert(
        data.availability.map((a) => ({ ...a, business_id: biz.id, user_id: context.userId })),
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.string().max(20).optional(), limit: z.number().int().min(1).max(200).default(100) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("bookings")
      .select("*, booking_campaigns(slug, service)")
      .order("slot_start", { ascending: false })
      .limit(data.limit);
    if (data.status) query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "confirmed", "attended", "no_show", "cancelled", "won", "lost"]),
        revenue: z.number().min(0).max(10_000_000).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { status: data.status };
    if (data.revenue !== undefined) patch.revenue = data.revenue;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.status === "confirmed") patch.verified_at = new Date().toISOString();
    const { error } = await context.supabase.from("bookings").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type { BookingQuestion };