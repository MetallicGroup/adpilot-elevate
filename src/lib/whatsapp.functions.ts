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
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveAccess } = await import("@/lib/access.server");
    const access = await resolveAccess(supabaseAdmin, userId);
    const allowed = access.whatsappAllowed;
    const tier = access.tier;
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
      allowed,
      plan: tier,
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
    const { resolveAccess } = await import("@/lib/access.server");
    const access = await resolveAccess(supabaseAdmin, userId);
    if (!access.whatsappAllowed) {
      throw new Error(
        access.freeStarter.state === "consumed"
          ? "Planul gratuit s-a consumat luna aceasta. Alege Pro sau Premium ca să folosești în continuare asistentul WhatsApp."
          : "Alege mai întâi un plan (Starter gratuit, Pro sau Premium) ca să activezi asistentul WhatsApp.",
      );
    }
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
    const { supabase, userId } = context;
    await supabase
      .from("whatsapp_connections")
      .delete()
      .eq("user_id", userId);
    return { ok: true };
  });

/**
 * Read-only inbox: real conversation between the user and the AdPilot AI
 * assistant on the shared WhatsApp number. There is a single thread per user
 * (leads live in the CRM /leads, not here). Sending happens on WhatsApp itself
 * via the agent, so this view is read-only.
 */
export const getMyWhatsAppInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { resolveAccess } = await import("@/lib/access.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getCentralWhatsApp } = await import("./whatsapp.server");

    const access = await resolveAccess(supabaseAdmin, userId);
    const tier = access.tier;

    const { data: connection } = await supabase
      .from("whatsapp_connections")
      .select("id, user_phone, status, last_message_at")
      .maybeSingle();

    const { data: rows } = await supabase
      .from("whatsapp_messages")
      .select("id, direction, msg_type, text, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    const messages = (rows ?? [])
      .reverse()
      .map((m) => ({
        id: m.id as string,
        // direction "in" = userul a scris pe WhatsApp; "out" = răspunsul AdPilot.
        from: (m.direction === "in" ? "me" : "them") as "me" | "them",
        type: (m.msg_type ?? "text") as string,
        text: (m.text ?? "") as string,
        at: m.created_at as string,
      }));

    return {
      connection: connection ?? null,
      central_number: getCentralWhatsApp()?.displayNumber ?? null,
      allowed: access.whatsappAllowed,
      plan: tier,
      messages,
    };
  });