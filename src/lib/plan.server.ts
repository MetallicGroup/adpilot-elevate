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

export async function getUserPlanTier(supabaseAdmin: any, userId: string): Promise<PlanTier> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("price_id, status, current_period_end")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sub && ACTIVE_STATUSES.has(sub.status)) {
    const t = tierFromId(sub.price_id);
    if (t) return t;
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

export const WHATSAPP_UPGRADE_MESSAGE =
  "🔒 Asistentul AdPilot pe WhatsApp este disponibil doar în planurile *Pro* și *Premium*.\n\nPlanul *Starter* include lansarea campaniilor din aplicație. Fă upgrade din contul tău (Setări → Abonament) ca să controlezi campaniile direct de aici. 🚀";
