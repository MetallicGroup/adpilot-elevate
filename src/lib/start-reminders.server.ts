/**
 * Reamintiri pentru cei care au început /start și s-au oprit (fără poze sau fără cont conectat).
 * Fereastra de 24h nu e deschisă (codul de verificare nu o deschide), deci folosim șablonul
 * aprobat `continua_inregistrarea`, cu buton spre /start, unde continuă exact de unde au rămas.
 * Max. 2 reamintiri: după ~1 oră și după ~24 de ore. Nu scriem noaptea (21:00–09:00).
 */
import { getCentralWhatsApp, sendWhatsAppTemplate } from "./whatsapp.server";
import { isQuietHours } from "./wa-notify.server";
import { isPlaceholderEmail } from "./phone-auth.server";

export const REMINDER_TEMPLATE = "continua_inregistrarea";
const FIRST_AFTER_MS = 60 * 60 * 1000;
const SECOND_AFTER_MS = 24 * 60 * 60 * 1000;
const MAX_REMINDERS = 2;

/** Pasul la care a rămas, spus pe înțelesul omului (variabila {{2}} din șablon). */
function nextStepText(s: any, connected: boolean, needsEmail: boolean): string | null {
  if (needsEmail) return "adaugă adresa ta de email";
  if (!s.niche) return "spune-ne ce fel de afacere ai";
  if (!(s.photo_paths ?? []).length) return "trimite 2–3 poze cu afacerea ta";
  if (!connected) return "conectează Facebook sau TikTok";
  return null;
}

export async function runStartReminders(): Promise<{ sent: number; skipped: number; errors: number }> {
  const out = { sent: 0, skipped: 0, errors: 0 };
  const central = getCentralWhatsApp();
  if (!central || isQuietHours()) return out;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;

  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: rows } = await db
    .from("onboarding_sessions")
    .select("user_id, niche, photo_paths, created_at, reminder_count, reminder_last_at")
    .is("completed_at", null)
    .lt("reminder_count", MAX_REMINDERS)
    .gte("created_at", since)
    .limit(100);

  const now = Date.now();
  for (const s of rows ?? []) {
    try {
      const age = now - new Date(s.created_at).getTime();
      const due = s.reminder_count === 0 ? age >= FIRST_AFTER_MS : age >= SECOND_AFTER_MS;
      const last = s.reminder_last_at ? now - new Date(s.reminder_last_at).getTime() : Infinity;
      if (!due || last < 20 * 60 * 60 * 1000) {
        out.skipped++;
        continue;
      }
      const [{ data: wa }, { data: meta }, { data: tt }, { data: au }] = await Promise.all([
        db.from("whatsapp_connections").select("user_phone").eq("user_id", s.user_id).eq("status", "active").maybeSingle(),
        db.from("meta_connections").select("id").eq("user_id", s.user_id).eq("is_active", true).limit(1).maybeSingle(),
        db.from("tiktok_connections").select("id").eq("user_id", s.user_id).eq("is_active", true).limit(1).maybeSingle(),
        supabaseAdmin.auth.admin.getUserById(s.user_id),
      ]);
      const phone = String(wa?.user_phone ?? "").replace(/\D/g, "");
      const step = nextStepText(s, !!meta || !!tt, isPlaceholderEmail(au?.user?.email));
      if (!phone || !step) {
        out.skipped++;
        continue;
      }
      let ok = true;
      try {
        await sendWhatsAppTemplate(central.phoneNumberId, central.accessToken, phone, REMINDER_TEMPLATE, "ro", [
          String(s.niche ?? "afacerea ta").toLowerCase(),
          step,
        ]);
      } catch (e) {
        ok = false;
        console.error("[start-reminders] send failed", s.user_id, (e as Error).message);
      }
      // Și la eșec notăm momentul, ca să nu reîncercăm la fiecare rulare (reîncercăm a doua zi).
      await db
        .from("onboarding_sessions")
        .update({
          reminder_last_at: new Date().toISOString(),
          ...(ok ? { reminder_count: s.reminder_count + 1 } : {}),
        })
        .eq("user_id", s.user_id);
      if (ok) out.sent++;
      else out.errors++;
    } catch (e) {
      out.errors++;
      console.error("[start-reminders]", s.user_id, (e as Error).message);
    }
  }
  return out;
}
