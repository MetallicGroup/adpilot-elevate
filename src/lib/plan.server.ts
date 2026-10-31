/**
 * Plan tiers & feature gating (server-only).
 * clips2 / clips6 = doar clipuri și poze. Pro (Afacere) / Premium (Zilnic) = și reclame, și agent.
 */
import { CREDITS_PER_CLIP, PLAN_CATALOG } from "./plan-catalog";

export type PlanTier = "none" | "starter" | "clips2" | "clips6" | "pro" | "premium";

export function tierFromId(raw?: string | null): PlanTier | null {
  const v = (raw ?? "").toLowerCase();
  if (!v) return null;
  if (v.includes("premium") || v.includes("zilnic")) return "premium";
  if (v.includes("pro") || v.includes("afacere")) return "pro";
  if (v.includes("clips6")) return "clips6";
  if (v.includes("clips2")) return "clips2";
  if (v.includes("starter")) return "starter";
  return null;
}

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

/** Mediul de plăți în care rulează build-ul curent (din prefixul token-ului). */
function serverPaymentsEnv(): "sandbox" | "live" {
  const token = process.env.VITE_PAYMENTS_CLIENT_TOKEN ?? "";
  return token.startsWith("pk_live_") ? "live" : "sandbox";
}

export async function getUserPlanTier(supabaseAdmin: any, userId: string): Promise<PlanTier> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("price_id, status, current_period_end")
    .eq("user_id", userId)
    // Nu lăsa un abonament de sandbox să acorde funcții plătite în producție.
    .eq("environment", serverPaymentsEnv())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sub && ACTIVE_STATUSES.has(sub.status)) {
    // Un abonament trialing/past_due expirat (webhook întârziat) nu mai dă acces.
    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
    if (periodEnd === null || periodEnd > Date.now()) {
      const t = tierFromId(sub.price_id);
      if (t) return t;
    }
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan, subscription_status")
    .eq("id", userId)
    .maybeSingle();
  const t = tierFromId(profile?.plan);
  if (t) return t;

  return "none";
}

export function whatsappAllowedForTier(tier: PlanTier): boolean {
  return tier === "pro" || tier === "premium";
}

const TIER_CLIPS: Partial<Record<PlanTier, number>> = {
  clips2: PLAN_CATALOG[0].clips,
  clips6: PLAN_CATALOG[1].clips,
  pro: PLAN_CATALOG[2].clips,
  premium: PLAN_CATALOG[3].clips,
};

/** Total lunar în unități (1 clip = 10, 1 poză = 1). Fără plan: 0. */
export function monthlyCredits(tier: PlanTier): number {
  return (TIER_CLIPS[tier] ?? 0) * CREDITS_PER_CLIP;
}

export type CreditState = { tier: PlanTier; trial: boolean; limit: number; used: number };

/** Cât a consumat în perioada de facturare curentă, din clipuri și poze la un loc. */
export async function creditState(supabaseAdmin: any, userId: string): Promise<CreditState> {
  const tier = await getUserPlanTier(supabaseAdmin, userId);
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("status, current_period_start")
    .eq("user_id", userId)
    .eq("environment", serverPaymentsEnv())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const trial = sub?.status === "trialing";
  const limit = trial ? 0 : monthlyCredits(tier);
  if (limit === 0) return { tier, trial, limit, used: 0 };

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const since = sub?.current_period_start ? new Date(sub.current_period_start) : monthStart;
  const iso = since.toISOString();
  const [{ count: clips }, { count: photos }, { data: profile }, { data: onb }] = await Promise.all([
    supabaseAdmin
      .from("ai_clip_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("demo_status", "failed")
      .gte("created_at", iso),
    supabaseAdmin.from("ai_image_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", iso),
    supabaseAdmin.from("profiles").select("paywall").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("onboarding_sessions").select("demo_ready_at").eq("user_id", userId).maybeSingle(),
  ]);
  // Clipul deblocat la plată e primul din pachet.
  const firstClip = !!profile?.paywall && !!onb?.demo_ready_at && new Date(onb.demo_ready_at).getTime() >= since.getTime() - 2 * 86400_000 ? 1 : 0;
  return { tier, trial, limit, used: ((clips ?? 0) + firstClip) * CREDITS_PER_CLIP + (photos ?? 0) };
}

/** Verifică dacă userul mai poate genera o poză AI în perioada asta. */
export async function checkAiPhotoQuota(
  supabaseAdmin: any,
  userId: string,
): Promise<{ allowed: boolean; limit: number; used: number; tier: PlanTier }> {
  const c = await creditState(supabaseAdmin, userId);
  return { allowed: c.limit > 0 && c.used + 1 <= c.limit, limit: c.limit, used: c.used, tier: c.tier };
}

/** Mai poate face un clip nou în perioada asta? */
export async function checkAiClipQuota(
  supabaseAdmin: any,
  userId: string,
): Promise<{ allowed: boolean; limit: number; used: number; tier: PlanTier; trial: boolean }> {
  const c = await creditState(supabaseAdmin, userId);
  return { allowed: c.limit > 0 && c.used + CREDITS_PER_CLIP <= c.limit, limit: c.limit, used: c.used, tier: c.tier, trial: c.trial };
}

const UPGRADE_HINT = "Treci pe un pachet mai mare și plătești doar diferența: https://www.adpilot.ro/upgrade";

/** Mesajul pentru om când nu mai poate face clipuri noi în perioada asta. */
export function clipQuotaMessage(q: { limit: number; tier: PlanTier; trial: boolean }): string {
  if (q.limit === 0) {
    return "Clipurile noi sunt incluse în pachetele AdPilot, de la 89 lei pe lună: https://www.adpilot.ro/pricing 🎬";
  }
  return `Ai folosit clipurile din pachet pentru luna asta. Se reîncarcă la reînnoire. ${UPGRADE_HINT} 🎬`;
}

/** Mesajul pentru om când nu mai poate face poze în perioada asta. */
export function photoQuotaMessage(q: { limit: number }): string {
  return q.limit === 0
    ? "Pozele noi sunt incluse în pachetele AdPilot, de la 89 lei pe lună: https://www.adpilot.ro/pricing"
    : `Ai folosit pozele din pachet pentru luna asta. Se reîncarcă la reînnoire. ${UPGRADE_HINT}`;
}

/** Înregistrează o poză AI generată (contor lunar). */
export async function recordAiPhoto(supabaseAdmin: any, userId: string): Promise<void> {
  await supabaseAdmin.from("ai_image_usage").insert({ user_id: userId });
}

export const WHATSAPP_UPGRADE_MESSAGE =
  "🔒 Asistentul AdPilot pe WhatsApp și reclamele sunt incluse de la pachetul *Afacere* (495 lei pe lună). Treci pe el din contul tău și plătești doar diferența. 🚀";
