/**
 * Link personal din mail sau WhatsApp: omul intră direct, fără cod, pe pagina indicată.
 * Linkul e semnat (HMAC) și nu se salvează nimic în baza de date. Sesiunea se creează abia
 * la deschidere, ca scanerele de linkuri din mail să nu consume un token de unică folosință.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NEXT = { s: "/start", u: "/upgrade", m: "/materiale" } as const;
export type LoginNext = keyof typeof NEXT;

function sign(payload: string): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY lipsește");
  return createHmac("sha256", `login-link:${key}`).update(payload).digest("base64url").slice(0, 22);
}

export function loginLink(userId: string, next: LoginNext, ttlDays = 30, origin = "https://www.adpilot.ro"): string {
  const exp = Math.floor((Date.now() + ttlDays * 86400_000) / 1000).toString(36);
  const payload = `${userId}.${exp}.${next}`;
  return `${origin}/c/${payload}.${sign(payload)}`;
}

/** Întoarce utilizatorul și pagina dacă linkul e valid și neexpirat. */
export function verifyLoginLink(token: string): { userId: string; next: string } | null {
  const [userId, exp, next, sig] = (token ?? "").split(".");
  if (!userId || !exp || !next || !sig || !UUID.test(userId)) return null;
  if (!(next in NEXT) || parseInt(exp, 36) * 1000 < Date.now()) return null;
  const expected = Buffer.from(sign(`${userId}.${exp}.${next}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { userId, next: NEXT[next as LoginNext] };
}
