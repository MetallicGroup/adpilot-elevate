/**
 * Trimiterea notificărilor către patron pe WhatsApp, prin numărul central AdPilot.
 *
 * WhatsApp livrează mesaje libere doar în 24 de ore de la ultimul mesaj scris de om.
 * În afara ferestrei, trimitem template-ul aprobat (dacă notificarea are unul) sau nimic —
 * un mesaj liber ar fi acceptat de API, dar nu ar ajunge niciodată.
 * Notificările de rutină respectă orele de liniște (21:00–09:00, ora României).
 */
import { getCentralWhatsApp, sendWhatsAppMessage, sendWhatsAppTemplate } from "./whatsapp.server";

const WINDOW_MS = 23.5 * 60 * 60 * 1000;

/** Template-uri Utility (WhatsApp Manager), în română. Corpul exact e în comentariu. */
export const WA_TEMPLATES = {
  /** „🎯 Client nou din campania {{1}}: {{2}}, {{3}}. Scrie-mi aici ca să vezi răspunsurile lui.” */
  leadNew: "lead_nou",
  /** „✅ Reclama ta „{{1}}” a fost aprobată de {{2}} și a început să ruleze.” */
  adLive: "reclama_live",
  /** „⚠️ {{2}} a respins reclama „{{1}}”. Scrie-mi aici și o refacem împreună.” */
  adRejected: "reclama_respinsa",
} as const;

export type NotifyResult =
  | { sent: "text" | "template"; id: string }
  | { skipped: "no_whatsapp" | "quiet_hours" | "outside_window" }
  | { error: string };

function bucharestHour(d = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Bucharest" }).format(d),
  );
}

export function isQuietHours(d = new Date()): boolean {
  const h = bucharestHour(d);
  return h >= 21 || h < 9;
}

async function lastInboundAt(supabaseAdmin: any, userId: string): Promise<number | null> {
  const { data } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("created_at")
    .eq("user_id", userId)
    .eq("direction", "in")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.created_at ? new Date(data.created_at).getTime() : null;
}

export async function notifyOwner(
  supabaseAdmin: any,
  userId: string,
  msg: {
    text: string;
    /** Template folosit în afara ferestrei de 24h; fără el, mesajul se sare. */
    template?: { name: string; params: string[] };
    /** true = rutină (rapoarte): nu trimite între 21:00 și 09:00. */
    respectQuietHours?: boolean;
    kind: string;
  },
): Promise<NotifyResult> {
  const central = getCentralWhatsApp();
  const { data: wa } = await supabaseAdmin
    .from("whatsapp_connections")
    .select("id, user_phone")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const phone = wa?.user_phone ? String(wa.user_phone).replace(/\D/g, "") : "";
  if (!central || !phone) return { skipped: "no_whatsapp" };
  if (msg.respectQuietHours && isQuietHours()) return { skipped: "quiet_hours" };

  const last = await lastInboundAt(supabaseAdmin, userId);
  const inWindow = last !== null && Date.now() - last < WINDOW_MS;
  try {
    let id: string;
    let sent: "text" | "template";
    let logged: string;
    if (inWindow) {
      ({ id } = await sendWhatsAppMessage(central.phoneNumberId, central.accessToken, phone, {
        type: "text",
        text: msg.text,
      }));
      sent = "text";
      logged = msg.text;
    } else if (msg.template) {
      ({ id } = await sendWhatsAppTemplate(
        central.phoneNumberId,
        central.accessToken,
        phone,
        msg.template.name,
        "ro",
        msg.template.params,
      ));
      sent = "template";
      logged = `[template ${msg.template.name}] ${msg.template.params.join(" · ")}`;
    } else {
      return { skipped: "outside_window" };
    }
    await supabaseAdmin.from("whatsapp_messages").insert({
      user_id: userId,
      connection_id: wa.id,
      wa_message_id: id,
      direction: "out",
      msg_type: sent === "text" ? "text" : "template",
      text: logged,
      meta: { kind: msg.kind },
    });
    return { sent, id };
  } catch (e) {
    console.error(`[wa-notify] ${msg.kind} failed`, (e as Error).message);
    return { error: (e as Error).message };
  }
}
