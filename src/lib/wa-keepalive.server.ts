/**
 * Ține deschisă fereastra WhatsApp de 24h (nu folosim template-uri).
 *
 * WhatsApp ne lasă să scriem liber doar 24h după ultimul mesaj al omului. Când tace,
 * îi trimitem o reamintire după 8h și încă una după 20h (max. 2 pe perioadă de tăcere),
 * ca să răspundă și să primească în continuare clienții noi și alertele pe loc.
 * Rulează la fiecare oră. Nu scrie noaptea (21:00–09:00, ora României).
 */
import { getCentralWhatsApp, sendWhatsAppMessage } from "./whatsapp.server";
import { isQuietHours } from "./wa-notify.server";

const NUDGES = [
  "👋 Sunt aici dacă ai nevoie de ceva. Scrie-mi orice, chiar și un „ok”, ca să-ți pot trimite pe loc clienții noi și rezultatele reclamelor.",
  "Ca să-ți trimit imediat fiecare client nou, WhatsApp îmi cere să-mi scrii măcar o dată pe zi. Un simplu „👍” e suficient.",
  "Vrei să vezi cum merg reclamele azi? Scrie „raport” și îți trimit cifrele pe loc. 📊",
  "Ai vorbit deja cu clienții veniți din reclame? Spune-mi cum a mers — mă ajută să-ți îmbunătățesc reclama.",
  "Mă uit în continuare la reclamele tale. Răspunde-mi cu orice ca să rămâi conectat la notificări: clienți noi, aprobări, alerte.",
  "Întrebare rapidă: vrei să schimbăm ceva la reclamă — textul, poza sau bugetul? Scrie-mi și mă ocup.",
];

const FIRST_NUDGE_MS = 8 * 60 * 60 * 1000;
const SECOND_NUDGE_MS = 20 * 60 * 60 * 1000;
const WINDOW_END_MS = 23.5 * 60 * 60 * 1000;

/** Altă variantă decât ultima trimisă acestui om. */
function pickNudge(lastText: string | null): string {
  const pool = NUDGES.filter((n) => n !== lastText);
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function runWhatsAppKeepalive(): Promise<{ sent: number; skipped: number; errors: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const central = getCentralWhatsApp();
  if (!central || isQuietHours()) return { sent: 0, skipped: 0, errors: 0 };

  const { data: conns } = await supabaseAdmin
    .from("whatsapp_connections")
    .select("id, user_id, user_phone, keepalive_opt_out")
    .eq("status", "active")
    .eq("keepalive_opt_out", false)
    .not("user_phone", "is", null);
  if (!conns?.length) return { sent: 0, skipped: 0, errors: 0 };

  const now = Date.now();
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const conn of conns) {
    try {
      const { data: lastIn } = await supabaseAdmin
        .from("whatsapp_messages")
        .select("created_at")
        .eq("user_id", conn.user_id)
        .eq("direction", "in")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!lastIn) {
        skipped++;
        continue;
      }
      const silentFor = now - new Date(lastIn.created_at).getTime();
      if (silentFor < FIRST_NUDGE_MS || silentFor > WINDOW_END_MS) {
        skipped++;
        continue;
      }

      // Câte reamintiri am trimis de la ultimul lui mesaj (max. 2: la 8h și la 20h).
      const { data: nudges } = await supabaseAdmin
        .from("whatsapp_messages")
        .select("text, created_at")
        .eq("user_id", conn.user_id)
        .eq("direction", "out")
        .gt("created_at", lastIn.created_at)
        .contains("meta", { kind: "keepalive" })
        .order("created_at", { ascending: false });
      const count = nudges?.length ?? 0;
      const due = count === 0 || (count === 1 && silentFor >= SECOND_NUDGE_MS);
      if (!due) {
        skipped++;
        continue;
      }

      // Ultima variantă trimisă vreodată, ca să n-o repetăm.
      const { data: prev } = await supabaseAdmin
        .from("whatsapp_messages")
        .select("text")
        .eq("user_id", conn.user_id)
        .eq("direction", "out")
        .contains("meta", { kind: "keepalive" })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const phone = conn.user_phone!.replace(/\D/g, "");
      if (!phone) {
        skipped++;
        continue;
      }
      const text = pickNudge(prev?.text ?? null);
      const { id } = await sendWhatsAppMessage(central.phoneNumberId, central.accessToken, phone, {
        type: "text",
        text,
      });
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
