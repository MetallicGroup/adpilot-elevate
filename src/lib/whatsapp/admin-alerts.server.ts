/**
 * Admin WhatsApp alerts — go to the AdPilot owner's personal number.
 * Server-only.
 */
import { sendWhatsAppMessage } from "./sendMessage";

/** Owner number in E.164 digits (RO). Override with ADPILOT_ADMIN_WA_NUMBER. */
export function getAdminWaNumber(): string {
  const raw = process.env.ADPILOT_ADMIN_WA_NUMBER ?? "0733342513";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `4${digits}`; // 07... -> 407...
  if (!digits.startsWith("40")) digits = `40${digits}`;
  return digits;
}

export async function sendAdminAlert(text: string): Promise<void> {
  try {
    await sendWhatsAppMessage(getAdminWaNumber(), text);
  } catch (e) {
    console.error("[admin-alert] send failed:", e);
  }
}

function line(label: string, value?: string | null) {
  return value ? `${label}: ${value}\n` : "";
}

export async function notifyAdminNewSignup(p: {
  email?: string | null;
  name?: string | null;
  provider?: string | null;
  goal?: string | null;
}) {
  const msg =
    `🆕 *Cont nou AdPilot*\n\n` +
    line("Nume", p.name) +
    line("Email", p.email) +
    line("Înregistrare", p.provider) +
    line("Obiectiv", p.goal) +
    `\nData: ${new Date().toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}`;
  await sendAdminAlert(msg);
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
  const msg =
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
  await sendAdminAlert(msg);
}

export async function notifyAdminSupportRequest(p: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  problem: string;
  urgency?: string | null;
}) {
  const msg =
    `🆘 *Solicitare de asistență (WhatsApp AI)*\n\n` +
    line("Nume", p.name) +
    line("Telefon", p.phone) +
    line("Email", p.email) +
    line("Urgență", p.urgency) +
    `\nProblemă:\n${p.problem}\n\n` +
    `Data: ${new Date().toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}`;
  await sendAdminAlert(msg);
}
