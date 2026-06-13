import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getWhatsAppConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("whatsapp_connections")
      .select("id, phone_number_id, waba_id, display_phone, status, verify_token, last_message_at, created_at")
      .maybeSingle();
    return data ?? null;
  });

const SaveInput = z.object({
  phone_number_id: z.string().min(5),
  waba_id: z.string().optional(),
  display_phone: z.string().optional(),
  access_token: z.string().min(20),
});

export const saveWhatsAppConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateVerifyToken } = await import("./whatsapp.server");
    // Delete previous (one per user for now)
    await supabaseAdmin.from("whatsapp_connections").delete().eq("user_id", userId);
    const verify_token = generateVerifyToken();
    const { data: row, error } = await supabaseAdmin
      .from("whatsapp_connections")
      .insert({
        user_id: userId,
        phone_number_id: data.phone_number_id,
        waba_id: data.waba_id ?? null,
        display_phone: data.display_phone ?? null,
        access_token: data.access_token,
        verify_token,
        status: "active",
      })
      .select("id, verify_token")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const disconnectWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    await supabase.from("whatsapp_connections").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    return { ok: true };
  });

const TestInput = z.object({ to_phone: z.string().min(8) });

export const sendWhatsAppTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TestInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conn } = await supabaseAdmin
      .from("whatsapp_connections")
      .select("phone_number_id, access_token, id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!conn) throw new Error("Nu există conexiune WhatsApp");
    const { sendWhatsAppMessage } = await import("./whatsapp.server");
    const { id } = await sendWhatsAppMessage(
      conn.phone_number_id,
      conn.access_token,
      data.to_phone.replace(/\D/g, ""),
      { type: "text", text: "👋 Salut! Sunt asistentul tău AdPilot. Scrie-mi orice — pot să-ți arăt campaniile, să generez copy nou, să pun pe pauză reclame sau să creez una nouă (trimite-mi o poză 📸)." },
    );
    await supabaseAdmin.from("whatsapp_messages").insert({
      user_id: userId,
      connection_id: conn.id,
      wa_message_id: id,
      direction: "out",
      msg_type: "text",
      text: "Test message",
    });
    return { ok: true };
  });