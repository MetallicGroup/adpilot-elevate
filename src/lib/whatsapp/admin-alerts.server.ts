/**
 * Admin WhatsApp alerts — go to the AdPilot owner's personal number.
 * Trimit prin TEMPLATE aprobat (merg oricând, chiar și după fereastra de 24h),
 * cu fallback pe text liber dacă template-ul eșuează (ex. în fereastra deschisă).
 * Server-only.
 */
import { getCentralWhatsApp, sendWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/whatsapp.server";

const TEMPLATE_LANG = "ro";

/** Owner number in E.164 digits (RO). Override with ADPILOT_ADMIN_WA_NUMBER. */
export function getAdminWaNumber(): string {
  const raw = process.env.ADPILOT_ADMIN_WA_NUMBER ?? "0733342513";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `4${digits}`; // 07... -> 407...
  if (!digits.startsWith("40")) digits = `40${digits}`;
  return digits;
}

export type AdminAlertResult = { sent: boolean; via: "template" | "text" | "none"; error?: string };

/** Text liber (fallback) — merge doar în fereastra de 24h. */
export async function sendAdminAlert(text: string): Promise<AdminAlertResult> {
  const central = getCentralWhatsApp();
  if (!central) {
    console.warn("[admin-alert] WhatsApp central neconfigurat — alertă sărită");
    return { sent: false, via: "none", error: "central_not_configured" };
  }
  try {
    await sendWhatsAppMessage(central.phoneNumberId, central.accessToken, getAdminWaNumber(), {
      type: "text",
      text,
    });
    return { sent: true, via: "text" };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[admin-alert] send failed:", e);
    return { sent: false, via: "none", error: err };
  }
}

/** Trimite un template aprobat; dacă pică, cade pe textul liber. */
async function sendAdminTemplate(
  templateName: string,
  params: string[],
  fallbackText: string,
): Promise<AdminAlertResult> {
  const central = getCentralWhatsApp();
  if (!central) {
    console.warn("[admin-alert] WhatsApp central neconfigurat — alertă sărită");
    return { sent: false, via: "none", error: "central_not_configured" };
  }
  // Retry: erorile tranzitorii (cold start, hiccup de rețea) nu trebuie să piardă
  // notificarea. 2 încercări pe template înainte de fallback pe text liber.
  let templateErr = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await sendWhatsAppTemplate(
        central.phoneNumberId,
        central.accessToken,
        getAdminWaNumber(),
        templateName,
        TEMPLATE_LANG,
        params,
      );
      return { sent: true, via: "template" };
    } catch (e) {
      templateErr = e instanceof Error ? e.message : String(e);
      console.warn(`[admin-alert] template ${templateName} attempt ${attempt}/2 failed:`, e);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 700));
    }
  }
  const fb = await sendAdminAlert(fallbackText);
  if (fb.sent) return { sent: true, via: "text", error: `template: ${templateErr}` };
  return { sent: false, via: "none", error: `template: ${templateErr} | text: ${fb.error}` };
}

function line(label: string, value?: string | null) {
  return value ? `${label}: ${value}\n` : "";
}

const v = (s?: string | null) => (s ?? "").trim() || "—";

export async function notifyAdminNewSignup(p: {
  email?: string | null;
  name?: string | null;
  provider?: string | null;
  goal?: string | null;
}) {
  const fallback =
    `🆕 *Cont nou AdPilot*\n\n` +
    line("Nume", p.name) +
    line("Email", p.email) +
    line("Înregistrare", p.provider) +
    line("Obiectiv", p.goal) +
    `\nData: ${new Date().toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}`;
  // template cont_nou: {{1}} nume, {{2}} email, {{3}} înregistrare
  return sendAdminTemplate("cont_nou", [v(p.name), v(p.email), v(p.provider)], fallback);
}

export async function notifyAdminNewSubscription(p: {
  email?: string | null;
  name?: string | null;
  plan?: string | null;
  amount?: string | null;
  status?: string | null;
  trialEnd?: string | null;
  business?: string | null;
  niche?: string | null;
  website?: string | null;
  phone?: string | null;
  environment?: string | null;
}) {
  const fallback =
    `💳 *Abonament nou* (cha-ching!)\n\n` +
    line("Client", p.name) +
    line("Email", p.email) +
    line("Telefon", p.phone) +
    line("Plan", p.plan) +
    line("Sumă", p.amount) +
    line("Status", p.status) +
    line("Trial până la", p.trialEnd) +
    line("Afacere", p.business) +
    line("Domeniu", p.niche) +
    line("Website", p.website) +
    line("Mediu", p.environment) +
    `\nData: ${new Date().toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}`;
  // template abonament_nou: {{1}} client, {{2}} email, {{3}} plan, {{4}} sumă
  await sendAdminTemplate(
    "abonament_nou",
    [v(p.name), v(p.email), v(p.plan), v(p.amount)],
    fallback,
  );
}

export async function notifyAdminSupportRequest(p: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  problem: string;
  urgency?: string | null;
  metaError?: string | null;
}) {
  const fallback =
    `🆘 *Solicitare de asistență (WhatsApp AI)*\n\n` +
    line("Nume", p.name) +
    line("Telefon", p.phone) +
    line("Email", p.email) +
    line("Mesajul clientului", p.problem) +
    line("Eroare Meta", p.metaError) +
    `\nData: ${new Date().toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}`;
  // template suport_nou: {{1}} nume, {{2}} telefon, {{3}} mesajul clientului, {{4}} eroare Meta
  await sendAdminTemplate(
    "suport_nou",
    [v(p.name), v(p.phone), v(p.problem), v(p.metaError)],
    fallback,
  );
}
