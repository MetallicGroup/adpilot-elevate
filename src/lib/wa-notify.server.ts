/**
 * Trimiterea notificărilor către patron pe WhatsApp, prin numărul central AdPilot.
 *
 * WhatsApp livrează mesaje libere doar în 24 de ore de la ultimul mesaj scris de om.
 * Nu folosim template-uri: în afara ferestrei, mesajele importante se păstrează și pleacă
 * imediat ce patronul scrie ceva; reamintirile din wa-keepalive țin fereastra deschisă.
 * Notificările de rutină respectă orele de liniște (21:00–09:00, ora României).
 */
import { getCentralWhatsApp, sendWhatsAppMessage } from "./whatsapp.server";

const WINDOW_MS = 23.5 * 60 * 60 * 1000;

export type NotifyResult =
  | { sent: "text"; id: string }
  | { held: true }
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

/** true dacă omul a scris în ultimele ~24h (putem trimite mesaje libere). */
export async function isWindowOpen(supabaseAdmin: any, userId: string): Promise<boolean> {
  const last = await lastInboundAt(supabaseAdmin, userId);
  return last !== null && Date.now() - last < WINDOW_MS;
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

/**
 * La primul mesaj al patronului (fereastra s-a deschis), trimite mesajele complete păstrate
 * din ultimele 7 zile, în ordine. Întoarce câte a trimis.
 */
export async function flushPendingNotifications(
  supabaseAdmin: any,
  userId: string,
  conn: { id: string; phone: string },
): Promise<number> {
  const central = getCentralWhatsApp();
  if (!central) return 0;
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: rows } = await supabaseAdmin
    .from("wa_pending_notifications")
    .select("id, kind, text")
    .eq("user_id", userId)
    .is("delivered_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(20);
  let sent = 0;
  for (const r of rows ?? []) {
    try {
      const { id } = await sendWhatsAppMessage(central.phoneNumberId, central.accessToken, conn.phone, {
        type: "text",
        text: r.text,
      });
      await supabaseAdmin.from("wa_pending_notifications").update({ delivered_at: new Date().toISOString() }).eq("id", r.id);
      await supabaseAdmin.from("whatsapp_messages").insert({
        user_id: userId,
        connection_id: conn.id,
        wa_message_id: id,
        direction: "out",
        msg_type: "text",
        text: r.text,
        meta: { kind: `${r.kind}_details` },
      });
      sent++;
    } catch (e) {
      console.error("[wa-notify] flush failed", (e as Error).message);
    }
  }
  return sent;
}

export async function notifyOwner(
  supabaseAdmin: any,
  userId: string,
  msg: {
    text: string;
    /** true = important (lead, aprobare, respingere): dacă fereastra e închisă, îl păstrăm până scrie. */
    holdIfClosed?: boolean;
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
  if (!inWindow) {
    // Fără template-uri: mesajul așteaptă până patronul scrie ceva (vezi flushPendingNotifications).
    if (!msg.holdIfClosed) return { skipped: "outside_window" };
    await supabaseAdmin.from("wa_pending_notifications").insert({ user_id: userId, kind: msg.kind, text: msg.text });
    return { held: true };
  }
  try {
    const { id } = await sendWhatsAppMessage(central.phoneNumberId, central.accessToken, phone, {
      type: "text",
      text: msg.text,
    });
    await supabaseAdmin.from("whatsapp_messages").insert({
      user_id: userId,
      connection_id: wa.id,
      wa_message_id: id,
      direction: "out",
      msg_type: "text",
      text: msg.text,
      meta: { kind: msg.kind },
    });
    return { sent: "text", id };
  } catch (e) {
    console.error(`[wa-notify] ${msg.kind} failed`, (e as Error).message);
    if (msg.holdIfClosed) {
      await supabaseAdmin.from("wa_pending_notifications").insert({ user_id: userId, kind: msg.kind, text: msg.text });
      return { held: true };
    }
    return { error: (e as Error).message };
  }
}
