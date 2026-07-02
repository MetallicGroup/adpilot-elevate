import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  count: z.number().int().min(1).max(500),
});

/**
 * Manual warm-up: performs N safe READ-only Marketing API calls
 * against the user's own ad account. Used to accumulate clean calls
 * to improve the app's Marketing API error-rate before App Review.
 *
 * All endpoints are Marketing API READ (act_<id>/*), no writes.
 */
export const warmupMetaCalls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { metaApiVersion } = await import("./meta.server");

    const { data: conn } = await supabaseAdmin
      .from("meta_connections")
      .select("id, access_token")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!conn?.access_token) throw new Error("Fără conexiune Meta activă");

    const { data: adAcc } = await supabaseAdmin
      .from("meta_ad_accounts")
      .select("ad_account_id")
      .eq("user_id", userId)
      .eq("connection_id", conn.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!adAcc?.ad_account_id) throw new Error("Selectează un cont publicitar în Setări");

    const v = metaApiVersion();
    const token = encodeURIComponent(conn.access_token);
    const acct = adAcc.ad_account_id;

    // Safe Marketing API READ endpoints (all under act_<id>).
    // NOTE: /adsets and /ads hit user-level rate limits fast. Keep the mix
    // biased toward the account-level endpoint which is cheaper.
    const endpoints = [
      `/act_${acct}?fields=name,account_status,currency`,
      `/act_${acct}?fields=name,account_status,currency`,
      `/act_${acct}?fields=name,account_status,currency`,
      `/act_${acct}/campaigns?fields=id,name,status&limit=5`,
      `/act_${acct}/insights?fields=spend,impressions&date_preset=today&limit=1`,
    ];

    let ok = 0;
    let errors = 0;
    const errorSamples: string[] = [];

    for (let i = 0; i < data.count; i++) {
      const path = endpoints[i % endpoints.length];
      try {
        const r = await fetch(`https://graph.facebook.com/${v}${path}&access_token=${token}`);
        const j: any = await r.json();
        if (!r.ok || j?.error) {
          errors++;
          if (errorSamples.length < 3) {
            errorSamples.push(`${path} → ${j?.error?.message ?? r.status}`);
          }
          // Stop early on auth/permission/rate-limit failures — no point spamming errors.
          // 190=token, 200=permission, 10=auth, 17=user rate limit, 613=throttle, 4=app rate limit, 32=page-level rate limit
          const code = j?.error?.code;
          if ([190, 200, 10, 17, 613, 4, 32].includes(code)) {
            return { ok, errors, stopped: true, reason: j?.error?.message, samples: errorSamples };
          }
        } else {
          ok++;
        }
      } catch (e: any) {
        errors++;
        if (errorSamples.length < 3) errorSamples.push(`${path} → ${e?.message}`);
      }
      // Slow pacing (~1 req / 2s) — Meta user-level rate limit is aggressive.
      await new Promise((res) => setTimeout(res, 2000));
    }

    return { ok, errors, stopped: false, samples: errorSamples };
  });