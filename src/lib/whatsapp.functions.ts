import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Shared-number WhatsApp model.
 * AdPilot owns ONE WhatsApp Business number (env: ADPILOT_WA_*).
 * Users only save their own phone number, then tap "Activează" → wa.me
 * link opens WhatsApp with a prefilled activation message containing
 * a short code. The webhook maps the sender phone → user, persists the
 * activation, and the bot replies with a welcome message.
 */

export const getMyWhatsApp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("whatsapp_connections")
      .select("id, user_phone, status, activation_code, activated_at, last_message_at")
      .maybeSingle();
    const { getCentralWhatsApp, buildWaMeLink } = await import("./whatsapp.server");
    const central = getCentralWhatsApp();
    let activation_link: string | null = null;
    if (central && data?.activation_code && data.status !== "active") {
      const text = `Salut, vreau să activez AdPilot pentru contul meu. Cod: ${data.activation_code}`;
      activation_link = buildWaMeLink(central.displayNumber, text);
    }
    return {
      connection: data ?? null,
      central_number: central?.displayNumber ?? null,
      activation_link,
      configured: !!central,
    };
  });

const SavePhoneInput = z.object({
  phone: z
    .string()
    .trim()
    .min(8, "Număr prea scurt")
    .max(20, "Număr prea lung")
    .regex(/^[+0-9\s().-]+$/, "Caractere invalide"),
});

export const saveMyWhatsAppPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SavePhoneInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizePhone, generateActivationCode, getCentralWhatsApp, buildWaMeLink } =
      await import("./whatsapp.server");
    const phone = normalizePhone(data.phone);
    if (phone.length < 8) throw new Error("Număr invalid");

    const { data: existing } = await supabaseAdmin
      .from("whatsapp_connections")
      .select("user_id")
      .eq("user_phone", phone)
      .maybeSingle();
    if (existing && existing.user_id !== userId) {
      throw new Error("Acest număr e deja folosit de alt cont AdPilot");
    }

    const activation_code = generateActivationCode();
    const { error } = await supabaseAdmin
      .from("whatsapp_connections")
      .upsert(
        {
          user_id: userId,
          user_phone: phone,
          activation_code,
          status: "pending",
          activated_at: null,
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);

    const central = getCentralWhatsApp();
    const activation_link = central
      ? buildWaMeLink(
          central.displayNumber,
          `Salut, vreau să activez AdPilot pentru contul meu. Cod: ${activation_code}`,
        )
      : null;

    return {
      ok: true,
      activation_code,
      activation_link,
      central_number: central?.displayNumber ?? null,
    };
  });

export const disconnectMyWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    await supabase
      .from("whatsapp_connections")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    return { ok: true };
  });