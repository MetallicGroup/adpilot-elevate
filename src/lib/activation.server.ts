/**
 * Drip de activare: userii care s-au înscris (email confirmat) dar NU au conectat
 * Facebook primesc câte un email pe zi, 3 zile (24h/48h/72h), cu numărul de suport.
 * WhatsApp se trimite DOAR celor cu opt-in (au conectat numărul la bot), best-effort.
 * Rulează dintr-un cron orar; candidații vin din get_activation_candidates().
 */

const SUPPORT_PHONE = "0740274969";
const ONBOARDING_URL = "https://www.adpilot.ro/onboarding";
const LOGO_URL = "https://adpilot.ro/adpilot-logo.png";

function firstName(name?: string | null): string {
  const n = (name ?? "").trim();
  return n ? ` ${n.split(/\s+/)[0]}` : "";
}

/** Șablon HTML branded: fundal alb, logo, buton, telefon de suport. */
function emailShell(heading: string, paras: string[], buttonLabel: string): string {
  const body = paras
    .map(
      (p) =>
        `<p style="font-size:15px;line-height:1.6;color:#4a4a63;margin:0 0 16px;">${p}</p>`,
    )
    .join("");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;box-shadow:0 2px 14px rgba(20,20,40,0.07);">
        <tr><td align="center" style="padding:34px 32px 6px;">
          <img src="${LOGO_URL}" width="118" alt="AdPilot" style="display:block;width:118px;height:auto;" />
        </td></tr>
        <tr><td style="padding:8px 36px 34px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#16162a;">
          <h1 style="font-size:22px;line-height:1.3;margin:0 0 14px;font-weight:700;color:#16162a;">${heading}</h1>
          ${body}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;"><tr>
            <td style="border-radius:12px;background:linear-gradient(90deg,#6a4bff,#a24bff);">
              <a href="${ONBOARDING_URL}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">${buttonLabel} →</a>
            </td>
          </tr></table>
          <p style="font-size:14px;line-height:1.6;color:#6b6b85;margin:0;">Ai nevoie de ajutor? Sună-mă sau scrie-mi direct: <b style="color:#16162a;">${SUPPORT_PHONE}</b>.<br/><span style="color:#9a9ab0;">— Daniel, AdPilot</span></p>
        </td></tr>
      </table>
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;"><tr>
        <td align="center" style="padding:18px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#9a9ab0;font-size:12px;line-height:1.6;">
          AdPilot · <a href="https://adpilot.ro" style="color:#7c5cff;text-decoration:none;">adpilot.ro</a><br/>Tu conduci afacerea. AdPilot conduce reclamele.
        </td>
      </tr></table>
    </td></tr>
  </table>
</body></html>`;
}

function reminderEmail(
  step: number,
  name?: string | null,
): { subject: string; text: string; html: string } {
  const hi = `Salut${firstName(name)}`;
  if (step <= 1) {
    return {
      subject: "Ai făcut cont pe AdPilot — hai să pornim prima reclamă 🚀",
      text:
        `${hi}!\n\nTe-ai înscris pe AdPilot, dar n-ai pornit încă prima reclamă. Durează ~2 minute: ` +
        "conectează-ți pagina de Facebook și îți lansăm campania automat — iar clienții îți vin direct pe WhatsApp.\n\n" +
        `👉 Continuă aici: ${ONBOARDING_URL}\n\nAi nevoie de ajutor? Sună-mă direct: ${SUPPORT_PHONE}.\n\n— Daniel, AdPilot`,
      html: emailShell(
        `${hi}! Hai să pornim prima ta reclamă 🚀`,
        [
          "Te-ai înscris pe AdPilot, dar n-ai pornit încă prima reclamă.",
          "Durează ~2 minute: conectează-ți pagina de Facebook și îți lansăm campania automat — iar clienții îți vin direct pe WhatsApp.",
        ],
        "Conectează Facebook",
      ),
    };
  }
  if (step === 2) {
    return {
      subject: "Încă un pas și primești clienți 👇",
      text:
        `${hi}!\n\nEști la un pas de prima ta campanie. Conectează Facebook și AdPilot se ocupă de restul — ` +
        "reclame pe Facebook și Instagram, iar lead-urile îți vin pe WhatsApp.\n\n" +
        `👉 ${ONBOARDING_URL}\n\nDacă vrei, te ajut personal să pornești: ${SUPPORT_PHONE}.\n\n— Daniel, AdPilot`,
      html: emailShell(
        `${hi}! Ești la un pas de primii clienți 👇`,
        [
          "Conectează Facebook și AdPilot se ocupă de restul — reclame pe Facebook și Instagram, iar lead-urile îți vin direct pe WhatsApp.",
          "E mai simplu decât pare, iar dacă te blochezi sunt aici să te ajut.",
        ],
        "Continuă configurarea",
      ),
    };
  }
  return {
    subject: "Ultimul reminder de la mine 🙂",
    text:
      `${hi},\n\nE ultimul mesaj de la mine. Dacă te-ai blocat undeva, sună-mă direct și pornim împreună ` +
      `prima reclamă în câteva minute: ${SUPPORT_PHONE}.\n\n👉 ${ONBOARDING_URL}\n\n— Daniel, AdPilot`,
    html: emailShell(
      `${hi}, ultimul reminder de la mine 🙂`,
      [
        "E ultimul email de la mine — nu vreau să te agasez.",
        "Dacă te-ai blocat undeva, sună-mă direct și pornim împreună prima ta reclamă în câteva minute. Chiar te ajut personal.",
      ],
      "Pornește acum",
    ),
  };
}

/** Trimite emailul de reminder „ziua 1" către adrese de test (gated de cron). */
export async function sendActivationTest(
  emails: string[],
): Promise<{ sent: string[]; failed: Array<{ email: string; error?: string }> }> {
  const { sendUserEmail } = await import("@/lib/user-email.server");
  const mail = reminderEmail(1, "");
  const sent: string[] = [];
  const failed: Array<{ email: string; error?: string }> = [];
  for (const e of emails.slice(0, 10)) {
    const r = await sendUserEmail(e, "[TEST] " + mail.subject, mail.text, mail.html);
    if (r.sent) sent.push(e);
    else failed.push({ email: e, error: r.error });
  }
  return { sent, failed };
}

function apologyEmail(name?: string | null): { subject: string; text: string; html: string } {
  const hi = `Salut${firstName(name)}`;
  return {
    subject: "Ne pare rău — a fost o eroare de-a noastră 🙏",
    text:
      `${hi},\n\n` +
      "Ne pare sincer rău — ai încercat să-ți pornești contul pe AdPilot și te-a blocat o eroare tehnică de-a noastră. Am reparat-o complet.\n\n" +
      "Acum durează doar 2 minute: conectează-ți pagina de Facebook și AdPilot lansează reclamele automat pentru afacerea ta — iar clienții îți vin direct pe WhatsApp, gestionate cu AI.\n\n" +
      `👉 Continuă aici: ${ONBOARDING_URL}\n\n` +
      `Dacă ai nevoie de ajutor, sună-mă sau scrie-mi direct: ${SUPPORT_PHONE}. Te ajut personal să pornești.\n\n` +
      "— Daniel, AdPilot",
    html: emailShell(
      `${hi}, ne pare rău — a fost o eroare de-a noastră 🙏`,
      [
        "Ai încercat să-ți pornești contul pe AdPilot și te-a blocat o eroare tehnică de-a noastră. <b>Am reparat-o complet.</b>",
        "Acum durează doar 2 minute: conectează-ți pagina de Facebook și AdPilot lansează reclamele automat pentru afacerea ta — iar clienții îți vin direct pe WhatsApp, gestionate cu AI.",
      ],
      "Conectează Facebook și pornește",
    ),
  };
}

/** Trimite emailul de scuze către TOȚI userii cu email confirmat (broadcast one-off). */
export async function runApologyBroadcast(): Promise<{ sent: number; failed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendUserEmail } = await import("@/lib/user-email.server");
  const seen = new Set<string>();
  let sent = 0;
  let failed = 0;
  for (let page = 1; page <= 6; page++) {
    const { data } = await (supabaseAdmin as any).auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    if (!users.length) break;
    for (const u of users) {
      const email: string | undefined = u.email;
      if (!email || !u.email_confirmed_at) continue; // doar reali (confirmați)
      if (email.endsWith("@adpilot.ro")) continue; // sărim adresele proprii
      if (seen.has(email)) continue;
      seen.add(email);
      const name = (u.user_metadata?.full_name as string) ?? null;
      const mail = apologyEmail(name);
      const r = await sendUserEmail(email, mail.subject, mail.text, mail.html);
      if (r.sent) sent++;
      else failed++;
    }
    if (users.length < 200) break;
  }
  return { sent, failed };
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
      const res = await sendUserEmail(c.email, mail.subject, mail.text, mail.html);
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
