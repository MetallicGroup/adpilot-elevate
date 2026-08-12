// @ts-nocheck
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { GoalId } from "@/lib/goals";
import type { BookingQuestion, LandingCopy } from "@/lib/booking/types";
import { DEFAULT_AVAILABILITY } from "@/lib/booking/availability";

const API_VERSION = process.env["META_API_VERSION"] || "v21.0";
const SITE_URL = "https://adpilot.ro";

export type DetectedPixel = {
  id: string;
  name: string;
  ad_account_id: string;
  last_fired_time: string | null;
  active: boolean;
};

async function activeConnection(userId: string) {
  const { data } = await supabaseAdmin
    .from("meta_connections")
    .select("id, access_token")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
}

/** Listează Pixelii deja existenți în conturile publicitare Meta ale userului. */
export async function detectPixelsCore(userId: string): Promise<{ pixels: DetectedPixel[]; connected: boolean }> {
  const conn = await activeConnection(userId);
  if (!conn?.access_token) return { pixels: [], connected: false };

  const { data: accounts } = await supabaseAdmin
    .from("meta_ad_accounts")
    .select("ad_account_id, account_name")
    .eq("user_id", userId);

  const out: DetectedPixel[] = [];
  for (const acc of accounts ?? []) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${API_VERSION}/${acc.ad_account_id}/adspixels?fields=id,name,last_fired_time&limit=25&access_token=${encodeURIComponent(conn.access_token)}`,
      );
      const json: any = await res.json();
      if (!res.ok) continue;
      for (const p of json?.data ?? []) {
        const lastFired = p.last_fired_time ?? null;
        out.push({
          id: String(p.id),
          name: p.name || acc.account_name || "Pixel",
          ad_account_id: acc.ad_account_id,
          last_fired_time: lastFired,
          active: !!lastFired && Date.now() - new Date(lastFired).getTime() < 30 * 86_400_000,
        });
      }
    } catch {
      /* ignore account */
    }
  }
  return { pixels: out, connected: true };
}

function slugify(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function uniqueSlug(base: string) {
  let slug = base || "adpilot";
  for (let i = 2; i < 40; i++) {
    const { data: taken } = await supabaseAdmin
      .from("booking_campaigns")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!taken) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export type LandingDraft = {
  objective: Exclude<GoalId, "sales">;
  business_name: string;
  service: string;
  city: string | null;
  offer: string | null;
  phone: string | null;
  copy: LandingCopy;
  questions: BookingQuestion[];
};

/** Generează (fără salvare) textele + întrebările pentru pagina obiectivului ales. */
export async function buildLandingDraftCore(
  userId: string,
  input: {
    objective: Exclude<GoalId, "sales">;
    business_name: string;
    service: string;
    city?: string | null;
    offer?: string | null;
    phone?: string | null;
  },
): Promise<LandingDraft> {
  const { generateObjectiveLandingCopy, generateBookingQuestions, classifyNiche } = await import(
    "@/lib/booking/ai.server"
  );

  const niche = await classifyNiche(input.service).catch(() => "general");
  const [copy, questions] = await Promise.all([
    generateObjectiveLandingCopy({
      objective: input.objective,
      businessName: input.business_name,
      service: input.service,
      city: input.city ?? null,
      offer: input.offer ?? null,
    }),
    input.objective === "calls"
      ? Promise.resolve([] as BookingQuestion[])
      : generateBookingQuestions({
          niche: niche as never,
          businessName: input.business_name,
          city: input.city ?? null,
          service: input.service,
          offer: input.offer ?? null,
        }).catch(() => [] as BookingQuestion[]),
  ]);

  return {
    objective: input.objective,
    business_name: input.business_name,
    service: input.service,
    city: input.city ?? null,
    offer: input.offer ?? null,
    phone: input.phone ?? null,
    copy,
    questions: input.objective === "leads" ? questions.slice(0, 3) : questions,
  };
}

/** Salvează profilul afacerii + pagina și o publică la /b/<slug>. */
export async function saveLandingCore(userId: string, draft: LandingDraft) {
  const niche = await (await import("@/lib/booking/ai.server"))
    .classifyNiche(draft.service)
    .catch(() => "general");

  const { data: existing } = await supabaseAdmin
    .from("business_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: biz, error: bizErr } = await supabaseAdmin
    .from("business_profiles")
    .upsert(
      {
        user_id: userId,
        name: draft.business_name,
        niche: existing?.niche && existing.niche !== "general" ? existing.niche : niche,
        city: draft.city ?? existing?.city ?? null,
        phone: draft.phone ?? existing?.phone ?? null,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();
  if (bizErr) throw new Error(bizErr.message);

  const { count } = await supabaseAdmin
    .from("booking_availability")
    .select("id", { count: "exact", head: true })
    .eq("business_id", biz.id);
  if (!count) {
    await supabaseAdmin
      .from("booking_availability")
      .insert(DEFAULT_AVAILABILITY.map((r) => ({ ...r, business_id: biz.id, user_id: userId })));
  }

  const slug = await uniqueSlug(`${slugify(draft.business_name)}-${slugify(draft.service)}`.slice(0, 60));

  const { data: page, error } = await supabaseAdmin
    .from("booking_campaigns")
    .insert({
      user_id: userId,
      business_id: biz.id,
      slug,
      service: draft.service,
      offer: draft.offer,
      status: "published",
      objective: draft.objective,
      call_phone: draft.objective === "calls" ? (draft.phone ?? biz.phone ?? null) : null,
      landing_copy: draft.copy,
    })
    .select("id, slug")
    .single();
  if (error) throw new Error(error.message);

  if (draft.questions.length) {
    await supabaseAdmin.from("booking_questions").insert(
      draft.questions.map((q, i) => ({
        key: q.key,
        label: q.label,
        type: q.type,
        options: q.options ?? [],
        required: !!q.required,
        position: i,
        source: q.source ?? "ai",
        user_id: userId,
        booking_campaign_id: page.id,
      })),
    );
  }

  await supabaseAdmin.from("booking_services").insert({
    name: draft.service,
    duration_min: 60,
    position: 0,
    user_id: userId,
    booking_campaign_id: page.id,
  });

  return { id: page.id as string, slug: page.slug as string, url: `${SITE_URL}/b/${page.slug}` };
}
