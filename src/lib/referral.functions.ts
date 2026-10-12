import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ClaimInput = z.object({
  referral_code: z.string().trim().min(1).max(40),
});

/**
 * Sets referral_code once (only if still null) — used for Google/Facebook
 * paths where metadata wasn't available at auth.users insert time.
 */
export const claimReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ClaimInput.parse(d))
  .handler(async ({ data, context }) => {
    const code = data.referral_code.trim().slice(0, 40);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("referral_code")
      .eq("id", uid)
      .maybeSingle();

    if (profile?.referral_code) {
      return { ok: true as const, already: true as const, referral_code: profile.referral_code };
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ referral_code: code })
      .eq("id", uid)
      .is("referral_code", null);

    if (error) {
      console.error("[claimReferral]", error);
      throw new Error("Nu am putut salva referral-ul.");
    }
    return { ok: true as const, already: false as const, referral_code: code };
  });
