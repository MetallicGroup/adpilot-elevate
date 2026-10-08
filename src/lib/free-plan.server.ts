/**
 * Logica de server pentru perioadele gratuite (server-only):
 *  - `startFreePlanClocks`: pentru cei care au ales Starter (gratuit) și au trecut de
 *    trialul de 7 zile, pornește ceasul lunar de 7 zile când au prima reclamă activă.
 *  - `runFreePlanExpiry`: două treceri —
 *      (1) expirarea trialului de 7 zile (de la crearea contului): pentru Pro/Premium
 *          neplătiți → pune campaniile pe pauză + trimite pe WhatsApp LINKUL de plată
 *          Stripe; pentru Starter → mesaj că trece pe 7 zile/lună.
 *      (2) consumul celor 7 zile/lună (Starter): pune campaniile pe pauză + notifică.
 */

/** Link scurt de plată pentru WhatsApp (creează sesiunea Stripe la click). */
async function payLinkFor(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("profiles")
    .select("pay_token")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.pay_token) return null;
  return `https://www.adpilot.ro/api/public/pay/${data.pay_token}`;
}

async function getActiveConn(
  userId: string,
): Promise<{ id: string; user_phone: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: conn } = await supabaseAdmin
    .from("whatsapp_connections")
    .select("id, user_phone")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!conn?.user_phone) return null;
  return { id: conn.id as string, user_phone: conn.user_phone as string };
}

async function logOut(userId: string, connId: string, id: string, text: string, kind: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("whatsapp_messages").insert({
    user_id: userId,
    connection_id: connId,
    wa_message_id: id,
    direction: "out",
    msg_type: "text",
    text,
    meta: { kind },
  });
}

/** Mesaj de reactivare cu LINK de plată (Pro/Premium care n-au plătit). */
async function sendReactivationMessage(userId: string, chosenPlan: string | null): Promise<void> {
  const { getCentralWhatsApp, sendWhatsAppMessage, sendWhatsAppTemplate } = await import(
    "@/lib/whatsapp.server"
  );
  const central = getCentralWhatsApp();
  if (!central) return;
  const conn = await getActiveConn(userId);
  if (!conn) return;
  const phone = conn.user_phone.replace(/\D/g, "");
  const link = await payLinkFor(userId);
  const planName = (chosenPlan ?? "").toLowerCase().includes("premium") ? "Premium" : "Pro";

  const text =
    `🎉 Cele 7 zile gratuite s-au încheiat — ai lansat reclame ca un profesionist!\n\n` +
    `Ca să continui NELIMITAT cu planul *${planName}* (campanii non-stop + asistent WhatsApp), ` +
    `plătește rapid și sigur cu cardul aici:\n${link}\n\n` +
    `După plată, contul tău se reactivează automat și pornim din nou. 💳`;

  // Fereastra de 24h deschisă → text liber cu linkul. Altfel → template static (fallback).
  try {
    const { id } = await sendWhatsAppMessage(central.phoneNumberId, central.accessToken, phone, {
      type: "text",
      text,
    });
    await logOut(userId, conn.id, id, text, "signup_trial_ended_pay");
    return;
  } catch (e) {
    console.warn("[free-plan] reactivation free-form failed, fallback template:", e);
  }
  try {
    const { id } = await sendWhatsAppTemplate(
      central.phoneNumberId,
      central.accessToken,
      phone,
      "plan_gratuit_consumat",
      "ro",
      [],
    );
    await logOut(userId, conn.id, id, text, "signup_trial_ended_pay_template");
  } catch (e) {
    console.error("[free-plan] reactivation template failed:", e);
  }
}

/** Mesaj: trialul de 7 zile s-a încheiat, rămâi pe planul gratuit 7 zile/lună. */
async function sendStarterBonusEndedMessage(userId: string): Promise<void> {
  const { getCentralWhatsApp, sendWhatsAppMessage } = await import("@/lib/whatsapp.server");
  const central = getCentralWhatsApp();
  if (!central) return;
  const conn = await getActiveConn(userId);
  if (!conn) return;
  const phone = conn.user_phone.replace(/\D/g, "");
  const text =
    "🎉 Cele 7 zile gratuite s-au încheiat! Rămâi pe planul *Starter gratuit* cu " +
    "*7 zile gratuite în fiecare lună*.\n\nPentru campanii NELIMITATE, non-stop, treci pe " +
    "Pro sau Premium: https://adpilot.ro/pricing";
  try {
    const { id } = await sendWhatsAppMessage(central.phoneNumberId, central.accessToken, phone, {
      type: "text",
      text,
    });
    await logOut(userId, conn.id, id, text, "signup_trial_ended_starter");
  } catch (e) {
    console.warn("[free-plan] starter bonus-ended message failed:", e);
  }
}

/** Mesajul de consum al celor 7 zile/lună (Starter). */
async function sendMonthlyConsumedMessage(userId: string): Promise<void> {
  const { getCentralWhatsApp, sendWhatsAppMessage, sendWhatsAppTemplate } = await import(
    "@/lib/whatsapp.server"
  );
  const { FREE_STARTER_CONSUMED_MESSAGE } = await import("@/lib/access.server");
  const central = getCentralWhatsApp();
  if (!central) return;
  const conn = await getActiveConn(userId);
  if (!conn) return;
  const phone = conn.user_phone.replace(/\D/g, "");
  try {
    const { id } = await sendWhatsAppTemplate(
      central.phoneNumberId,
      central.accessToken,
      phone,
      "plan_gratuit_consumat",
      "ro",
      [],
    );
    await logOut(userId, conn.id, id, FREE_STARTER_CONSUMED_MESSAGE, "free_consumed");
    return;
  } catch {
    /* fallback */
  }
  try {
    const { id } = await sendWhatsAppMessage(central.phoneNumberId, central.accessToken, phone, {
      type: "text",
      text: FREE_STARTER_CONSUMED_MESSAGE,
    });
    await logOut(userId, conn.id, id, FREE_STARTER_CONSUMED_MESSAGE, "free_consumed");
  } catch (e) {
    console.error("[free-plan] monthly consumed message failed:", e);
  }
}

async function pauseActiveCampaigns(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { setMetaCampaignStatus } = await import("@/lib/campaign-control.server");
  const { data: active } = await supabaseAdmin
    .from("campaigns")
    .select("id")
    .eq("user_id", userId)
    .eq("platform", "meta")
    .eq("status", "active");
  for (const c of active ?? []) {
    try {
      await setMetaCampaignStatus({ userId, campaignId: c.id, next: "PAUSED" });
    } catch (e) {
      console.error("[free-plan] pause campaign failed", c.id, e);
    }
  }
}

/** Pornește ceasul lunar de 7 zile pt. Starter (post trial de 7z) cu reclamă activă. */
export async function startFreePlanClocks(): Promise<{ started: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { currentPlanMonth, isFreeChoice } = await import("@/lib/access.server");
  const month = currentPlanMonth();
  const nowIso = new Date().toISOString();

  // Starter (gratuit), trecuți de trialul de 7 zile, care n-au pornit ceasul luna asta.
  const { data: profiles } = await (supabaseAdmin as any)
    .from("profiles")
    .select("id, chosen_plan, free_plan_month, signup_trial_ends_at")
    .lt("signup_trial_ends_at", nowIso)
    .or(`free_plan_month.is.null,free_plan_month.neq.${month}`);
  if (!profiles?.length) return { started: 0 };

  let started = 0;
  for (const p of profiles as any[]) {
    if (!isFreeChoice(p.chosen_plan)) continue;
    const { count } = await supabaseAdmin
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("user_id", p.id)
      .eq("platform", "meta")
      .eq("status", "active");
    if ((count ?? 0) > 0) {
      await (supabaseAdmin as any)
        .from("profiles")
        .update({
          free_plan_month: month,
          free_plan_started_at: nowIso,
          free_plan_notified_at: null,
        })
        .eq("id", p.id);
      started++;
    }
  }
  return { started };
}

/** Expirări: trialul de 7 zile + cele 7 zile/lună (Starter). */
export async function runFreePlanExpiry(): Promise<{
  signupExpired: number;
  monthlyExpired: number;
  errors: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { currentPlanMonth, FREE_STARTER_DAYS, resolveAccess, isFreeChoice } = await import(
    "@/lib/access.server"
  );
  const month = currentPlanMonth();
  const nowIso = new Date().toISOString();

  let signupExpired = 0;
  let monthlyExpired = 0;
  let errors = 0;

  // ---- Pass 1: trialul de 7 zile (de la crearea contului) ----
  const { data: trialGone } = await (supabaseAdmin as any)
    .from("profiles")
    .select("id, chosen_plan")
    .lt("signup_trial_ends_at", nowIso)
    .is("signup_trial_notified_at", null);
  for (const p of (trialGone ?? []) as any[]) {
    try {
      const access = await resolveAccess(supabaseAdmin, p.id);
      if (access.paid) {
        // A plătit între timp → marcăm ca notificat, fără mesaj.
        await (supabaseAdmin as any)
          .from("profiles")
          .update({ signup_trial_notified_at: nowIso })
          .eq("id", p.id);
        continue;
      }
      if (isFreeChoice(p.chosen_plan)) {
        // Starter → continuă pe 7 zile/lună (nu blocăm, doar anunțăm).
        await sendStarterBonusEndedMessage(p.id);
      } else {
        // Pro/Premium neplătit → blocăm + link de plată pe WhatsApp.
        await pauseActiveCampaigns(p.id);
        await sendReactivationMessage(p.id, p.chosen_plan);
      }
      await (supabaseAdmin as any)
        .from("profiles")
        .update({ signup_trial_notified_at: nowIso })
        .eq("id", p.id);
      signupExpired++;
    } catch (e) {
      console.error("[free-plan] signup-trial expiry", p.id, e);
      errors++;
    }
  }

  // ---- Pass 2: cele 7 zile/lună (Starter) ----
  const cutoff = new Date(Date.now() - FREE_STARTER_DAYS * 86_400_000).toISOString();
  const { data: monthlyGone } = await (supabaseAdmin as any)
    .from("profiles")
    .select("id, chosen_plan")
    .eq("free_plan_month", month)
    .not("free_plan_started_at", "is", null)
    .lt("free_plan_started_at", cutoff)
    .is("free_plan_notified_at", null);
  for (const p of (monthlyGone ?? []) as any[]) {
    try {
      if (!isFreeChoice(p.chosen_plan)) continue;
      const access = await resolveAccess(supabaseAdmin, p.id);
      if (access.paid) continue;
      await pauseActiveCampaigns(p.id);
      await sendMonthlyConsumedMessage(p.id);
      await (supabaseAdmin as any)
        .from("profiles")
        .update({ free_plan_notified_at: nowIso })
        .eq("id", p.id);
      monthlyExpired++;
    } catch (e) {
      console.error("[free-plan] monthly expiry", p.id, e);
      errors++;
    }
  }

  return { signupExpired, monthlyExpired, errors };
}
