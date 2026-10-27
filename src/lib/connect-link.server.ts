/**
 * Link personal de conectare Facebook, trimis de bot pe WhatsApp: omul îl deschide de pe
 * telefon și dă accept la Facebook, fără să intre în contul AdPilot. Linkul e semnat
 * (HMAC) și expiră în 24 de ore; nu se salvează nimic în baza de date.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sign(payload: string): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY lipsește");
  return createHmac("sha256", `meta-connect:${key}`).update(payload).digest("base64url").slice(0, 22);
}

export function metaConnectLink(userId: string, origin = "https://www.adpilot.ro"): string {
  const payload = `${userId}.${Math.floor((Date.now() + TTL_MS) / 1000).toString(36)}`;
  return `${origin}/fb/${payload}.${sign(payload)}`;
}

/** Întoarce userId-ul dacă linkul e valid și neexpirat. */
export function verifyMetaConnectToken(token: string): string | null {
  const [userId, exp, sig] = (token ?? "").split(".");
  if (!userId || !exp || !sig || !UUID.test(userId)) return null;
  if (parseInt(exp, 36) * 1000 < Date.now()) return null;
  const expected = Buffer.from(sign(`${userId}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return userId;
}
