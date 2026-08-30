import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StripeEnv } from "@/lib/stripe.server";

export type OnboardingStatus = {
  hasPhone: boolean;
  hasMetaConnection: boolean;
  hasActiveSubscription: boolean;
  /** A ales un plan? = abonament plătit ACTIV SAU Starter gratuit activ luna asta. */
  planChosen: boolean;
  /** WhatsApp conectat + activat (a trimis mesajul de activare). */
  whatsappConnected: boolean;
  /** Admin — exceptat de la gate-ul de onboarding. */
  isAdmin: boolean;
  /** Cont creat prin Facebook (system-user) fără email → trebuie completat. */
  needsEmail: boolean;
  subscriptionStatus: string | null;
  trialEnd: string | null;
  planTier: "none" | "starter" | "pro" | "premium";
  whatsappAllowed: boolean;
  freeStarter: {
    state: "none" | "eligible" | "active" | "consumed";
    endsAt: string | null;
  };
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

    const [{ data: meta }, { data: sub }, { data: profile }, { data: wa }] = await Promise.all([
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
      supabase
        .from("whatsapp_connections")
        .select("status")
        .eq("user_id", userId)
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
    // Access central: factorează și Starter gratuit (nu doar abonamentul plătit).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveAccess } = await import("@/lib/access.server");
    const access = await resolveAccess(supabaseAdmin, userId);
    const planChosen = isActive || access.freeStarter.state === "active";

    // Admin: exceptat de la gate-ul de onboarding (nu se poate bloca singur).
    const { data: adminRole } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    // Email lipsă: conturile create prin Facebook (system-user) au un email
    // temporar → trebuie completat cu unul real în onboarding.
    const { isPendingEmail } = await import("@/lib/facebook-signup.server");
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const authEmail = authUser?.user?.email ?? null;
    const needsEmail =
      isPendingEmail(authEmail) ||
      (authUser?.user?.user_metadata as any)?.pending_email === true;

    return {
      needsEmail,
      hasPhone: !!(profile?.phone && String(profile.phone).trim()),
      hasMetaConnection: !!meta,
      hasActiveSubscription: isActive,
      planChosen,
      whatsappConnected: (wa as any)?.status === "active",
      isAdmin: !!adminRole,
      subscriptionStatus: sub?.status ?? null,
      trialEnd: sub?.trial_end ?? null,
      planTier,
      whatsappAllowed: access.whatsappAllowed,
      freeStarter: { state: access.freeStarter.state, endsAt: access.freeStarter.endsAt },
    };
  });

/**
 * Pornește planul „Starter gratuit" pentru luna curentă (fără card).
 * Ceasul de 3 zile NU pornește aici — pornește când prima reclamă devine activă
 * (setat de job-ul de insights). Idempotent; blocat dacă deja consumat luna asta.
 */
export const startFreeStarter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveAccess, currentPlanMonth } = await import("@/lib/access.server");
    const access = await resolveAccess(supabaseAdmin, userId);
    if (access.paid) return { ok: true as const, note: "already_paid" };
    if (access.freeStarter.state === "active") return { ok: true as const, note: "already_active" };
    if (access.freeStarter.state === "consumed") {
      throw new Error(
        "Ai folosit deja cele 3 zile gratuite luna aceasta. Revino luna viitoare sau alege Pro/Premium.",
      );
    }
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({
        free_plan_month: currentPlanMonth(),
        free_plan_started_at: null,
        free_plan_notified_at: null,
        plan: "starter",
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const, note: "started" };
  });

/**
 * Setează emailul real pentru conturile create prin Facebook (system-user), care
 * pornesc cu un email temporar. Verifică să nu fie deja folosit de alt cont.
 */
export const setMyEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const d = (raw ?? {}) as { email?: string };
    const email = (d.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new Error("Introdu o adresă de email validă.");
    }
    if (email.endsWith("@pending.adpilot.ro")) {
      throw new Error("Introdu adresa ta reală de email.");
    }
    return { email };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Emailul nu poate aparține deja altui cont.
    const { data: existing } = await (supabaseAdmin as any).rpc("get_user_id_by_email", {
      p_email: data.email,
    });
    if (existing && existing !== userId) {
      throw new Error("Acest email este deja folosit de alt cont. Alege altul sau loghează-te cu el.");
    }

    const { data: cur } = await supabaseAdmin.auth.admin.getUserById(userId);
    const meta = { ...((cur?.user?.user_metadata as any) ?? {}), pending_email: false };
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: data.email,
      email_confirm: true,
      user_metadata: meta,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
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