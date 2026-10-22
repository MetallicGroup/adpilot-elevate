import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

function clientIp(): string | null {
  const h = getRequest()?.headers;
  const raw = h?.get("x-forwarded-for") ?? h?.get("x-real-ip") ?? "";
  return raw.split(",")[0]?.trim() || null;
}

function requestOrigin(): string {
  const req = getRequest();
  try {
    return new URL(req.url).origin;
  } catch {
    return "https://www.adpilot.ro";
  }
}

/** Erorile pentru om (cod greșit, prea multe încercări) trec mai departe; restul devin un mesaj generic. */
async function friendly<T>(fn: () => Promise<T>): Promise<T> {
  const { PhoneAuthError } = await import("@/lib/phone-auth.server");
  try {
    return await fn();
  } catch (e) {
    if (e instanceof PhoneAuthError) throw new Error(e.message);
    console.error("[phone-auth]", (e as Error).message);
    throw new Error("A apărut o eroare. Încearcă din nou în câteva secunde.");
  }
}

/** Trimite codul de 6 cifre pe WhatsApp. Public (înainte de login). */
export const requestPhoneCode = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => {
    const d = (raw ?? {}) as { phone?: string; consent?: boolean };
    if (typeof d.phone !== "string" || !d.phone.trim()) throw new Error("Introdu numărul de telefon.");
    if (d.consent !== true) throw new Error("Bifează acordul pentru mesajele pe WhatsApp.");
    return { phone: d.phone.slice(0, 32) };
  })
  .handler(async ({ data }) =>
    friendly(async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { requestCode } = await import("@/lib/phone-auth.server");
      return requestCode(supabaseAdmin, { phone: data.phone, ip: clientIp() });
    }),
  );

/** Verifică codul și întoarce token-ul cu care browserul pornește sesiunea. */
export const verifyPhoneCode = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => {
    const d = (raw ?? {}) as { phone?: string; code?: string; referral?: string | null };
    if (typeof d.phone !== "string" || typeof d.code !== "string") throw new Error("Date lipsă.");
    return {
      phone: d.phone.slice(0, 32),
      code: d.code.slice(0, 12),
      referral: typeof d.referral === "string" ? d.referral.slice(0, 40) : null,
    };
  })
  .handler(async ({ data }) =>
    friendly(async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { verifyCode } = await import("@/lib/phone-auth.server");
      const r = await verifyCode(supabaseAdmin, { ...data, origin: requestOrigin() });
      return { tokenHash: r.tokenHash, isNew: r.isNew };
    }),
  );
