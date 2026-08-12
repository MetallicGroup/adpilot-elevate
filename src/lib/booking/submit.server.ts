// @ts-nocheck
import { slotsForDay } from "./availability";
import { sendCapiEvent } from "./capi.server";
import { sendWhatsAppMessage } from "@/lib/whatsapp/sendMessage";
import type { AvailabilityRule } from "./types";

type SubmitInput = {
  slug: string;
  full_name: string;
  phone: string;
  email?: string | null;
  service_id?: string | null;
  slot_start?: string | null;
  answers: Record<string, unknown>;
  attribution: Record<string, unknown>;
};

/** Scor de calificare 0-100 pe baza completitudinii răspunsurilor și a valorii serviciului. */
export function scoreBooking(args: {
  answers: Record<string, unknown>;
  questions: Array<{ key: string; required: boolean }>;
  price?: number | null;
  hasEmail: boolean;
  fromAd: boolean;
}): { score: number; tier: "hot" | "warm" | "cold" } {
  let score = 40;
  const total = args.questions.length || 1;
  const answered = args.questions.filter((q) => {
    const v = args.answers[q.key];
    return v !== undefined && v !== null && String(v).trim() !== "" && !(Array.isArray(v) && v.length === 0);
  }).length;
  score += Math.round((answered / total) * 30);
  if (args.hasEmail) score += 8;
  if (args.fromAd) score += 10;
  if ((args.price ?? 0) > 0) score += 12;
  score = Math.max(0, Math.min(100, score));
  return { score, tier: score >= 75 ? "hot" : score >= 50 ? "warm" : "cold" };
}

export async function submitBookingCore(supabaseAdmin: any, input: SubmitInput) {
  const { data: page } = await supabaseAdmin
    .from("booking_campaigns")
    .select("id, user_id, business_id, service, slug, pixel_id, campaign_id, meta_campaign_id, objective")
    .eq("slug", input.slug)
    .eq("status", "published")
    .maybeSingle();
  if (!page) throw new Error("Pagina de programare nu este disponibilă.");

  const [{ data: questions }, { data: service }, { data: rules }, { data: biz }] = await Promise.all([
    supabaseAdmin.from("booking_questions").select("key, label, required").eq("booking_campaign_id", page.id),
    input.service_id
      ? supabaseAdmin
          .from("booking_services")
          .select("id, name, duration_min, price")
          .eq("id", input.service_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("booking_availability")
      .select("weekday, start_time, end_time, slot_min, buffer_min")
      .eq("business_id", page.business_id),
    supabaseAdmin.from("business_profiles").select("name, city, phone").eq("id", page.business_id).maybeSingle(),
  ]);

  for (const q of questions ?? []) {
    if (!q.required) continue;
    const v = input.answers[q.key];
    if (v === undefined || v === null || String(v).trim() === "") {
      throw new Error(`Completează: ${q.label}`);
    }
  }

  const objective = page.objective ?? "bookings";
  const needsSlot = objective === "bookings";
  const durationMin = service?.duration_min ?? 60;
  const start = needsSlot && input.slot_start ? new Date(input.slot_start) : new Date();
  if (Number.isNaN(start.getTime())) throw new Error("Interval orar invalid.");
  const end = new Date(start.getTime() + durationMin * 60_000);
  const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

  const dayStart = new Date(`${date}T00:00:00`).toISOString();
  const dayEnd = new Date(new Date(`${date}T00:00:00`).getTime() + 86_400_000).toISOString();
  const [{ data: busy }, { data: blackouts }] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select("slot_start, slot_end")
      .eq("business_id", page.business_id)
      .in("status", ["pending", "confirmed", "attended", "won"])
      .lt("slot_start", dayEnd)
      .gt("slot_end", dayStart),
    supabaseAdmin
      .from("booking_blackouts")
      .select("starts_at, ends_at")
      .eq("business_id", page.business_id)
      .lt("starts_at", dayEnd)
      .gt("ends_at", dayStart),
  ]);

  const free = !needsSlot ? [] : slotsForDay({
    date,
    rules: (rules ?? []) as AvailabilityRule[],
    durationMin,
    busy: (busy ?? []).map((b: any) => ({ start: b.slot_start, end: b.slot_end })),
    blackouts: (blackouts ?? []).map((b: any) => ({ start: b.starts_at, end: b.ends_at })),
  });
  if (needsSlot && !free.includes(start.toISOString())) {
    throw new Error("Intervalul ales tocmai a fost ocupat. Alege alt interval.");
  }

  const attribution = input.attribution ?? {};
  const { score, tier } = scoreBooking({
    answers: input.answers,
    questions: (questions ?? []).map((q: any) => ({ key: q.key, required: !!q.required })),
    price: service?.price ?? null,
    hasEmail: !!input.email,
    fromAd: !!(attribution as any).fbclid || !!(attribution as any).ad_id,
  });

  const eventId = `bk_${crypto.randomUUID()}`;

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .insert({
      user_id: page.user_id,
      business_id: page.business_id,
      booking_campaign_id: page.id,
      campaign_id: page.campaign_id ?? null,
      full_name: input.full_name,
      phone: input.phone,
      email: input.email ?? null,
      service_id: service?.id ?? null,
      service_name: service?.name ?? page.service,
      slot_start: start.toISOString(),
      slot_end: end.toISOString(),
      answers: input.answers,
      attribution,
      status: "pending",
      qualification_score: score,
      qualification_tier: tier,
      capi_event_id: eventId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // CRM lead (aceleași ecrane /leads ca la lead forms)
  try {
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .insert({
        user_id: page.user_id,
        platform: "meta",
        campaign_id: page.campaign_id ?? null,
        external_lead_id: `booking_${booking.id}`,
        external_ad_id: (attribution as any).ad_id ?? null,
        external_campaign_id: (attribution as any).campaign_id ?? null,
        full_name: input.full_name,
        phone: input.phone,
        email: input.email ?? null,
        message: needsSlot
          ? `Programare: ${service?.name ?? page.service} — ${start.toLocaleString("ro-RO")}`
          : `Cerere ${objective === "calls" ? "de apel" : "de ofertă"}: ${service?.name ?? page.service}`,
        raw: { booking_id: booking.id, answers: input.answers, attribution },
        source_url: (attribution as any).landing_url ?? null,
        status: "new",
      })
      .select("id")
      .single();
    if (lead?.id) await supabaseAdmin.from("bookings").update({ lead_id: lead.id }).eq("id", booking.id);
  } catch (e) {
    console.error("[booking] lead insert failed", e);
  }

  // Meta CAPI — evenimentul Schedule optimizează campania după programări reale
  if (page.pixel_id) {
    try {
      const { data: conn } = await supabaseAdmin
        .from("meta_connections")
        .select("access_token")
        .eq("user_id", page.user_id)
        .eq("is_active", true)
        .maybeSingle();
      if (conn?.access_token) {
        const r = await sendCapiEvent(page.pixel_id, conn.access_token, {
          eventName: needsSlot ? "Schedule" : "Lead",
          eventId,
          eventSourceUrl: (attribution as any).landing_url ?? null,
          value: service?.price ?? null,
          user: {
            phone: input.phone,
            email: input.email ?? null,
            fullName: input.full_name,
            fbc: (attribution as any).fbc ?? null,
            fbp: (attribution as any).fbp ?? null,
          },
          customData: { content_name: service?.name ?? page.service, lead_tier: tier, lead_score: score },
        });
        if (r.ok) {
          await supabaseAdmin
            .from("bookings")
            .update({ capi_sent_at: new Date().toISOString() })
            .eq("id", booking.id);
        } else {
          console.error("[booking] CAPI error", r.error);
        }
      }
    } catch (e) {
      console.error("[booking] CAPI failed", e);
    }
  }

  // Notificare WhatsApp către proprietar
  try {
    const { data: wa } = await supabaseAdmin
      .from("whatsapp_connections")
      .select("user_phone, status")
      .eq("user_id", page.user_id)
      .maybeSingle();
    if (wa?.user_phone && wa.status === "connected") {
      const when = start.toLocaleString("ro-RO", { dateStyle: "full", timeStyle: "short" });
      const extras = (questions ?? [])
        .map((q: any) => {
          const v = input.answers[q.key];
          if (v === undefined || v === null || String(v).trim() === "") return null;
          return `• ${q.label}: ${Array.isArray(v) ? v.join(", ") : v}`;
        })
        .filter(Boolean)
        .join("\n");
      await sendWhatsAppMessage(
        wa.user_phone,
        `📅 Programare nouă${tier === "hot" ? " 🔥" : ""}\n\n${input.full_name} — ${input.phone}\n${service?.name ?? page.service}\n${when}${extras ? `\n\n${extras}` : ""}\n\nScor calificare: ${score}/100 (${tier})`,
      );
    }
  } catch (e) {
    console.error("[booking] WhatsApp notify failed", e);
  }

  return {
    ok: true as const,
    booking_id: booking.id as string,
    slot_start: start.toISOString(),
    business_name: biz?.name ?? null,
    business_phone: biz?.phone ?? null,
  };
}