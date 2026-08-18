import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StripeEnv } from "@/lib/stripe.server";

export type OnboardingStatus = {
  hasPhone: boolean;
  hasMetaConnection: boolean;
  hasActiveSubscription: boolean;
  subscriptionStatus: string | null;
  trialEnd: string | null;
  planTier: "none" | "starter" | "pro" | "premium";
  whatsappAllowed: boolean;
};

export const getOnboardingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => {
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<OnboardingStatus> => {
    const { supabase, userId } = context;

    const [{ data: meta }, { data: sub }, { data: profile }] = await Promise.all([
      supabase
        .from("meta_connections")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("status,current_period_end,trial_end,price_id")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      (supabase as any).from("profiles").select("phone").eq("id", userId).maybeSingle(),
    ]);

    const now = Date.now();
    const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end).getTime() : null;
    const isActive = !!sub && (
      ((sub.status === "active" || sub.status === "trialing" || sub.status === "past_due") &&
        (periodEnd === null || periodEnd > now)) ||
      (sub.status === "canceled" && periodEnd !== null && periodEnd > now)
    );

    const priceId = (sub?.price_id ?? "").toLowerCase();
    const planTier: OnboardingStatus["planTier"] = priceId.includes("premium")
      ? "premium"
      : priceId.includes("pro")
        ? "pro"
        : priceId.includes("starter")
          ? "starter"
          : "none";
    // Asistentul WhatsApp e disponibil doar în Pro și Premium.
    const whatsappAllowed = isActive && (planTier === "pro" || planTier === "premium");

    return {
      hasPhone: !!(profile?.phone && String(profile.phone).trim()),
      hasMetaConnection: !!meta,
      hasActiveSubscription: isActive,
      subscriptionStatus: sub?.status ?? null,
      trialEnd: sub?.trial_end ?? null,
      planTier,
      whatsappAllowed,
    };
  });

/** Salvează numărul de telefon în profil (folosit de gate-ul din onboarding, ex.
 *  pentru conturile create cu Google, care nu trec prin formularul de signup). */
export const saveUserPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { phone: string }) => {
    const digits = (data?.phone ?? "").replace(/\D/g, "");
    if (digits.length < 10) throw new Error("Introdu un număr de telefon valid.");
    return { phone: data.phone.trim() };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({ phone: data.phone })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });