/**
 * Drip de activare: userii care s-au înscris (email confirmat) dar NU au conectat
 * Facebook primesc câte un email pe zi, 3 zile (24h/48h/72h), cu numărul de suport.
 * WhatsApp se trimite DOAR celor cu opt-in (au conectat numărul la bot), best-effort.
 * Rulează dintr-un cron orar; candidații vin din get_activation_candidates().
 */

const SUPPORT_PHONE = "0733342513";
const ONBOARDING_URL = "https://www.adpilot.ro/onboarding";

function firstName(name?: string | null): string {
  const n = (name ?? "").trim();
  return n ? ` ${n.split(/\s+/)[0]}` : "";
}

function reminderEmail(step: number, name?: string | null): { subject: string; text: string } {
  const hi = `Salut${firstName(name)}`;
  if (step <= 1) {
    return {
      subject: "Ai făcut cont pe AdPilot — hai să pornim prima reclamă 🚀",
      text:
        `${hi}!\n\n` +
        "Te-ai înscris pe AdPilot, dar n-ai pornit încă prima reclamă. Durează ~2 minute: " +
        "conectează-ți pagina de Facebook și îți lansăm campania automat — iar clienții îți vin direct pe WhatsApp.\n\n" +
        `👉 Continuă aici: ${ONBOARDING_URL}\n\n` +
        `Ai nevoie de ajutor? Sună-mă sau scrie-mi direct: ${SUPPORT_PHONE}.\n\n` +
        "— Daniel, AdPilot",
    };
  }
  if (step === 2) {
    return {
      subject: "Încă un pas și primești clienți 👇",
      text:
        `${hi}!\n\n` +
        "Ești la un pas de prima ta campanie. Conectează Facebook și AdPilot se ocupă de restul — " +
        "reclame pe Facebook și Instagram, iar lead-urile îți vin pe WhatsApp.\n\n" +
        `👉 ${ONBOARDING_URL}\n\n` +
        `Dacă vrei, te ajut personal să pornești: ${SUPPORT_PHONE}.\n\n` +
        "— Daniel, AdPilot",
    };
  }
  return {
    subject: "Ultimul reminder de la mine 🙂",
    text:
      `${hi},\n\n` +
      "E ultimul mesaj de la mine. Dacă te-ai blocat undeva, sună-mă direct și pornim împreună " +
      `prima reclamă în câteva minute: ${SUPPORT_PHONE}.\n\n` +
      `👉 ${ONBOARDING_URL}\n\n` +
      "— Daniel, AdPilot",
  };
}

export async function runActivationReminders(): Promise<{
  emails: number;
  whatsapp: number;
  errors: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: candidates, error } = await (supabaseAdmin as any).rpc("get_activation_candidates");
  if (error) {
    console.error("[activation] rpc", error);
    return { emails: 0, whatsapp: 0, errors: 1 };
  }
  if (!candidates?.length) return { emails: 0, whatsapp: 0, errors: 0 };

  const { sendUserEmail } = await import("@/lib/user-email.server");
  let emails = 0;
  let whatsapp = 0;
  let errors = 0;

  for (const c of candidates as Array<{
    user_id: string;
    email: string;
    full_name: string | null;
    activation_step: number;
  }>) {
    const step = (c.activation_step ?? 0) + 1; // 1, 2 sau 3
    try {
      const mail = reminderEmail(step, c.full_name);
      const res = await sendUserEmail(c.email, mail.subject, mail.text);
      if (res.sent) emails++;
      else {
        errors++;
        console.error("[activation] email failed", c.email, res.error);
      }

      // WhatsApp DOAR pentru cei cu opt-in (au conectat numărul). Best-effort,
      // free-form → merge doar dacă fereastra de 24h e deschisă; altfel se ignoră.
      try {
        const { getCentralWhatsApp, sendWhatsAppMessage } = await import("@/lib/whatsapp.server");
        const central = getCentralWhatsApp();
        const { data: conn } = await supabaseAdmin
          .from("whatsapp_connections")
          .select("user_phone")
          .eq("user_id", c.user_id)
          .eq("status", "active")
          .maybeSingle();
        if (central && conn?.user_phone) {
          await sendWhatsAppMessage(
            central.phoneNumberId,
            central.accessToken,
            conn.user_phone.replace(/\D/g, ""),
            { type: "text", text: mail.text },
          );
          whatsapp++;
        }
      } catch {
        /* fereastră închisă / fără opt-in — normal, avem oricum email-ul */
      }

      // Avansează pasul (evită retrimiterea) + timestamp pentru pacing 1/zi.
      await (supabaseAdmin as any)
        .from("profiles")
        .update({ activation_step: step, activation_last_sent_at: new Date().toISOString() })
        .eq("id", c.user_id);
    } catch (e) {
      errors++;
      console.error("[activation]", c.user_id, e);
    }
  }
  return { emails, whatsapp, errors };
}
