import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { slotsForDay } from "./availability";
import type { AvailabilityRule } from "./types";

const AttributionSchema = z
  .object({
    fbclid: z.string().max(500).nullable().optional(),
    fbc: z.string().max(500).nullable().optional(),
    fbp: z.string().max(500).nullable().optional(),
    utm_source: z.string().max(120).nullable().optional(),
    utm_medium: z.string().max(120).nullable().optional(),
    utm_campaign: z.string().max(160).nullable().optional(),
    ad_id: z.string().max(60).nullable().optional(),
    adset_id: z.string().max(60).nullable().optional(),
    campaign_id: z.string().max(60).nullable().optional(),
    landing_url: z.string().max(1000).nullable().optional(),
  })
  .default({});

/** Datele publice ale unui landing page de programări (SSR). */
export const getBookingLanding = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: page } = await supabaseAdmin
      .from("booking_campaigns")
      .select("id, slug, service, offer, landing_copy, hero_image_url, business_id, status, pixel_id, objective, call_phone")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (!page) return null;

    const [{ data: biz }, { data: questions }, { data: services }] = await Promise.all([
      supabaseAdmin
        .from("business_profiles")
        .select("name, city, address, phone, logo_url, website, privacy_policy_url")
        .eq("id", page.business_id)
        .maybeSingle(),
      supabaseAdmin
        .from("booking_questions")
        .select("key, label, type, options, required, help_text, position")
        .eq("booking_campaign_id", page.id)
        .order("position"),
      supabaseAdmin
        .from("booking_services")
        .select("id, name, description, duration_min, price, position")
        .eq("booking_campaign_id", page.id)
        .order("position"),
    ]);

    return {
      page: {
        id: page.id,
        slug: page.slug,
        service: page.service,
        offer: page.offer,
        landing_copy: page.landing_copy,
        hero_image_url: page.hero_image_url,
        pixel_id: page.pixel_id,
        objective: (page as { objective?: string }).objective ?? "bookings",
        call_phone: (page as { call_phone?: string | null }).call_phone ?? null,
      },
      business: biz ?? null,
      questions: questions ?? [],
      services: services ?? [],
    };
  });

/** Sloturile libere pentru o zi și un serviciu. */
export const getBookingSlots = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().min(1).max(80),
        service_id: z.string().uuid().nullable().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: page } = await supabaseAdmin
      .from("booking_campaigns")
      .select("id, business_id")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (!page) return { slots: [] as string[] };

    const dayStart = new Date(`${data.date}T00:00:00`).toISOString();
    const dayEnd = new Date(new Date(`${data.date}T00:00:00`).getTime() + 86_400_000).toISOString();

    const [{ data: rules }, { data: blackouts }, { data: busy }, { data: svc }] = await Promise.all([
      supabaseAdmin
        .from("booking_availability")
        .select("weekday, start_time, end_time, slot_min, buffer_min")
        .eq("business_id", page.business_id),
      supabaseAdmin
        .from("booking_blackouts")
        .select("starts_at, ends_at")
        .eq("business_id", page.business_id)
        .lt("starts_at", dayEnd)
        .gt("ends_at", dayStart),
      supabaseAdmin
        .from("bookings")
        .select("slot_start, slot_end")
        .eq("business_id", page.business_id)
        .in("status", ["pending", "confirmed", "attended", "won"])
        .lt("slot_start", dayEnd)
        .gt("slot_end", dayStart),
      data.service_id
        ? supabaseAdmin.from("booking_services").select("duration_min").eq("id", data.service_id).maybeSingle()
        : Promise.resolve({ data: null as { duration_min: number } | null }),
    ]);

    const slots = slotsForDay({
      date: data.date,
      rules: (rules ?? []) as AvailabilityRule[],
      durationMin: svc?.duration_min ?? 60,
      busy: (busy ?? []).map((b) => ({ start: b.slot_start, end: b.slot_end })),
      blackouts: (blackouts ?? []).map((b) => ({ start: b.starts_at, end: b.ends_at })),
    });

    return { slots };
  });

/** Înregistrează o vizualizare de landing page (atribuire). */
export const trackBookingView = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1).max(80), attribution: AttributionSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: page } = await supabaseAdmin
      .from("booking_campaigns")
      .select("id, user_id")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (!page) return { ok: false };
    await supabaseAdmin.from("booking_page_views").insert({
      booking_campaign_id: page.id,
      user_id: page.user_id,
      attribution: data.attribution as never,
    });
    return { ok: true };
  });

/** Trimite o programare de pe landing page-ul public. */
export const submitBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().min(1).max(80),
        full_name: z.string().min(2).max(120),
        phone: z.string().min(6).max(40),
        email: z.string().email().max(160).nullable().optional(),
        service_id: z.string().uuid().nullable().optional(),
        slot_start: z.string().datetime().nullable().optional(),
        answers: z.record(z.string().max(40), z.union([z.string().max(500), z.array(z.string().max(120)).max(10), z.boolean(), z.number()])).default({}),
        attribution: AttributionSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { submitBookingCore } = await import("./submit.server");
    return submitBookingCore(supabaseAdmin as never, data);
  });