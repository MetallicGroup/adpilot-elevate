import { timingSafeEqual } from "crypto";

/**
 * Cron / internal hook auth.
 * Accepts (in order of preference):
 *   - x-cron-secret header == CRON_SECRET
 *   - Authorization: Bearer <CRON_SECRET>
 *   - apikey header == SUPABASE_SERVICE_ROLE_KEY (server-only, never sent to browser)
 * The anon/publishable key is intentionally NOT accepted because it is
 * embedded in browser bundles and would allow anyone to trigger cron jobs.
 */
function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifyCronAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const headerSecret = request.headers.get("x-cron-secret");
  if (cronSecret && headerSecret && safeEq(headerSecret, cronSecret)) return true;

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (cronSecret && bearer && safeEq(bearer, cronSecret)) return true;

  const apikey = request.headers.get("apikey");
  if (serviceKey && apikey && safeEq(apikey, serviceKey)) return true;
  if (serviceKey && bearer && safeEq(bearer, serviceKey)) return true;

  return false;
}