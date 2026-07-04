/**
 * Keep the WhatsApp 24h customer service window open.
 *
 * Meta's rules let us reply freely for 24h after the client's last inbound
 * message. If the client goes silent and the window is about to close, we
 * proactively ask for feedback about the ad / the app — this both keeps the
 * conversation open (no template needed) and gathers useful signal.
 *
 * Run this hourly. It picks users whose last inbound is between ~22h and
 * ~23h40m old, and where we haven't already sent them a keep-alive nudge
 * after that inbound.
 */
import { getCentralWhatsApp, sendWhatsAppMessage } from "./whatsapp.server";

const NUDGES = [
  "Salut! 👋 Vroiam să te întreb — ce părere ai despre reclama pe care ți-am pornit-o? A adus clienți așa cum te așteptai?",
  "Bună! 🙂 Cum ți se pare AdPilot până acum? E ceva ce ți-ar plăcea să funcționeze diferit?",
  "Hei! Vreo idee sau feedback despre reclamele tale? Orice sugestie ne ajută să facem treaba mai bună pentru tine. 🙌",
  "Salut! Vrei să dăm un mic upgrade la reclamă (text nou, poză nouă, alt oraș)? Zi-mi doar ce ai vrea diferit.",
];

function pickNudge() {
  return NUDGES[Math.floor(Math.random() * NUDGES.length)];
}

export async function runWhatsAppKeepalive(): Promise<{ sent: number; skipped: number; errors: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const central = getCentralWhatsApp();
  if (!central) return { sent: 0, skipped: 0, errors: 0 };

  const { data: conns } = await supabaseAdmin
    .from("whatsapp_connections")
    .select("id, user_id, user_phone")
    .eq("status", "active")
    .not("user_phone", "is", null);
  if (!conns?.length) return { sent: 0, skipped: 0, errors: 0 };

  const now = Date.now();
  const MIN_AGE_MS = 22 * 60 * 60 * 1000; // 22h
  const MAX_AGE_MS = 23 * 60 * 60 * 1000 + 40 * 60 * 1000; // 23h40m

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const conn of conns) {
    try {
      // Latest inbound
      const { data: lastIn } = await supabaseAdmin
        .from("whatsapp_messages")
        .select("id, created_at")
        .eq("user_id", conn.user_id)
        .eq("direction", "in")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!lastIn) {
        skipped++;
        continue;
      }
      const age = now - new Date(lastIn.created_at).getTime();
      if (age < MIN_AGE_MS || age > MAX_AGE_MS) {
        skipped++;
        continue;
      }

      // Skip if we already sent a keep-alive after this inbound
      const { data: existingNudge } = await supabaseAdmin
        .from("whatsapp_messages")
        .select("id")
        .eq("user_id", conn.user_id)
        .eq("direction", "out")
        .gt("created_at", lastIn.created_at)
        .contains("meta", { kind: "keepalive" })
        .limit(1)
        .maybeSingle();
      if (existingNudge) {
        skipped++;
        continue;
      }

      const phone = conn.user_phone!.replace(/\D/g, "");
      if (!phone) {
        skipped++;
        continue;
      }

      const text = pickNudge();
      const { id } = await sendWhatsAppMessage(
        central.phoneNumberId,
        central.accessToken,
        phone,
        { type: "text", text },
      );
      await supabaseAdmin.from("whatsapp_messages").insert({
        user_id: conn.user_id,
        connection_id: conn.id,
        wa_message_id: id,
        direction: "out",
        msg_type: "text",
        text,
        meta: { kind: "keepalive" },
      });
      sent++;
    } catch (e) {
      console.error("[wa-keepalive] user", conn.user_id, e);
      errors++;
    }
  }

  return { sent, skipped, errors };
}