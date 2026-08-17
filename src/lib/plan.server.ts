/**
 * Plan tiers & feature gating (server-only).
 * Starter = no WhatsApp assistant. Pro / Premium = full access.
 */

export type PlanTier = "none" | "starter" | "pro" | "premium";

function tierFromId(raw?: string | null): PlanTier | null {
  const v = (raw ?? "").toLowerCase();
  if (!v) return null;
  if (v.includes("premium")) return "premium";
  if (v.includes("pro")) return "pro";
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

/** Limita lunară de poze AI per plan: Starter/none = 0, Pro = 10, Premium = nelimitat. */
export function aiPhotoMonthlyLimit(tier: PlanTier): number {
  if (tier === "premium") return Infinity;
  if (tier === "pro") return 10;
  return 0;
}

/** Verifică dacă userul mai poate genera o poză AI luna aceasta. */
export async function checkAiPhotoQuota(
  supabaseAdmin: any,
  userId: string,
): Promise<{ allowed: boolean; limit: number; used: number; tier: PlanTier }> {
  const tier = await getUserPlanTier(supabaseAdmin, userId);
  const limit = aiPhotoMonthlyLimit(tier);
  if (limit === 0) return { allowed: false, limit, used: 0, tier };
  if (!isFinite(limit)) return { allowed: true, limit, used: 0, tier };
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin
    .from("ai_image_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());
  const used = count ?? 0;
  return { allowed: used < limit, limit, used, tier };
}

/** Înregistrează o poză AI generată (contor lunar). */
export async function recordAiPhoto(supabaseAdmin: any, userId: string): Promise<void> {
  await supabaseAdmin.from("ai_image_usage").insert({ user_id: userId });
}

export const WHATSAPP_UPGRADE_MESSAGE =
  "🔒 Asistentul AdPilot pe WhatsApp este disponibil doar în planurile *Pro* și *Premium*.\n\nPlanul *Starter* include lansarea campaniilor din aplicație. Fă upgrade din contul tău (Setări → Abonament) ca să controlezi campaniile direct de aici. 🚀";
