import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StripeEnv } from "@/lib/stripe.server";

export type OnboardingStatus = {
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

    const [{ data: meta }, { data: sub }] = await Promise.all([
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
      hasMetaConnection: !!meta,
      hasActiveSubscription: isActive,
      subscriptionStatus: sub?.status ?? null,
      trialEnd: sub?.trial_end ?? null,
      planTier,
      whatsappAllowed,
    };
  });