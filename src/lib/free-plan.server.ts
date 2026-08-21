/**
 * Planul „Starter gratuit 3 zile" — logica de server (server-only).
 *  - `startFreePlanClocks`: pornește ceasul de 3 zile când userul free-Starter are
 *    prima reclamă ACTIVĂ pe Meta (setează `profiles.free_plan_started_at`).
 *  - `runFreePlanExpiry`: la consum (start + 3 zile), pune campaniile pe pauză și
 *    trimite mesajul „planul gratuit s-a consumat" pe WhatsApp (template + fallback).
 */

/** Pornește ceasul pentru userii free-Starter care au deja o reclamă activă. */
export async function startFreePlanClocks(): Promise<{ started: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { currentPlanMonth } = await import("@/lib/access.server");
  const month = currentPlanMonth();

  const { data: profiles } = await (supabaseAdmin as any)
    .from("profiles")
    .select("id")
    .eq("free_plan_month", month)
    .is("free_plan_started_at", null);
  if (!profiles?.length) return { started: 0 };

  let started = 0;
  for (const p of profiles as { id: string }[]) {
    const { count } = await supabaseAdmin
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("user_id", p.id)
      .eq("platform", "meta")
      .eq("status", "active");
    if ((count ?? 0) > 0) {
      await (supabaseAdmin as any)
        .from("profiles")
        .update({ free_plan_started_at: new Date().toISOString() })
        .eq("id", p.id);
      started++;
    }
  }
  return { started };
}

/** Trimite mesajul de consum: template aprobat, cu fallback pe text liber (24h). */
async function sendConsumedMessage(userId: string): Promise<{ sent: boolean; via: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getCentralWhatsApp, sendWhatsAppMessage, sendWhatsAppTemplate } = await import(
    "@/lib/whatsapp.server"
  );
  const { FREE_STARTER_CONSUMED_MESSAGE } = await import("@/lib/access.server");
  const central = getCentralWhatsApp();
  if (!central) return { sent: false, via: "none" };

  const { data: conn } = await supabaseAdmin
    .from("whatsapp_connections")
    .select("id, user_phone")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!conn?.user_phone) return { sent: false, via: "none" };
  const phone = conn.user_phone.replace(/\D/g, "");

  const log = async (id: string, text: string) => {
    await supabaseAdmin.from("whatsapp_messages").insert({
      user_id: userId,
      connection_id: conn.id,
      wa_message_id: id,
      direction: "out",
      msg_type: "text",
      text,
      meta: { kind: "free_consumed" },
    });
  };

  // 1) Template aprobat (merge oricând, chiar în afara ferestrei de 24h).
  //    Template STATIC (fără variabile) + buton URL „Vezi planurile" → /pricing.
  try {
    const { id } = await sendWhatsAppTemplate(
      central.phoneNumberId,
      central.accessToken,
      phone,
      "plan_gratuit_consumat",
      "ro",
      [],
    );
    await log(id, FREE_STARTER_CONSUMED_MESSAGE);
    return { sent: true, via: "template" };
  } catch (e) {
    console.warn("[free-plan] template plan_gratuit_consumat failed, fallback text:", e);
  }
  // 2) Fallback text liber (doar dacă fereastra de 24h e deschisă).
  try {
    const { id } = await sendWhatsAppMessage(central.phoneNumberId, central.accessToken, phone, {
      type: "text",
      text: FREE_STARTER_CONSUMED_MESSAGE,
    });
    await log(id, FREE_STARTER_CONSUMED_MESSAGE);
    return { sent: true, via: "text" };
  } catch (e) {
    console.error("[free-plan] consumed message failed entirely:", e);
    return { sent: false, via: "none" };
  }
}

/** Consumul planului gratuit: pune campaniile pe pauză + notifică pe WhatsApp. */
export async function runFreePlanExpiry(): Promise<{
  notified: number;
  errors: number;
  capi?: { ok: number; fail: number; lastError?: string };
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { currentPlanMonth, FREE_STARTER_DAYS } = await import("@/lib/access.server");
  const { setMetaCampaignStatus } = await import("@/lib/campaign-control.server");

  const month = currentPlanMonth();
  const cutoff = new Date(Date.now() - FREE_STARTER_DAYS * 86_400_000).toISOString();

  const { data: profiles } = await (supabaseAdmin as any)
    .from("profiles")
    .select("id")
    .eq("free_plan_month", month)
    .not("free_plan_started_at", "is", null)
    .lt("free_plan_started_at", cutoff)
    .is("free_plan_notified_at", null);
  if (!profiles?.length) return { notified: 0, errors: 0 };

  let notified = 0;
  let errors = 0;
  const capi = { ok: 0, fail: 0, lastError: undefined as string | undefined };
  for (const p of profiles as { id: string }[]) {
    try {
      // Pune pe pauză campaniile active pe Meta (altfel ar rula reclame gratis).
      const { data: active } = await supabaseAdmin
        .from("campaigns")
        .select("id")
        .eq("user_id", p.id)
        .eq("platform", "meta")
        .eq("status", "active");
      for (const c of active ?? []) {
        try {
          await setMetaCampaignStatus({ userId: p.id, campaignId: c.id, next: "PAUSED" });
        } catch (e) {
          console.error("[free-plan] pause campaign failed", c.id, e);
        }
      }

      await sendConsumedMessage(p.id);

      // Meta CAPI: eveniment „TrialExpired" (server-side) pentru audiența de
      // retargeting „trial expirat". No-op dacă META_CAPI_TOKEN nu e setat.
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.id);
        const { sendMetaCapiEvent } = await import("@/lib/meta-capi.server");
        const r = await sendMetaCapiEvent("TrialExpired", {
          email: u?.user?.email ?? null,
          eventId: `trialexp_${p.id}_${month}`,
        });
        if (r.sent) capi.ok++;
        else {
          capi.fail++;
          capi.lastError = r.error;
        }
      } catch (e) {
        capi.fail++;
        capi.lastError = e instanceof Error ? e.message : String(e);
        console.error("[free-plan] CAPI TrialExpired", e);
      }

      await (supabaseAdmin as any)
        .from("profiles")
        .update({ free_plan_notified_at: new Date().toISOString() })
        .eq("id", p.id);
      notified++;
    } catch (e) {
      console.error("[free-plan-expiry]", p.id, e);
      errors++;
    }
  }
  return { notified, errors, capi };
}
