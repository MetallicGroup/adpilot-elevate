import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(5).max(4000),
});

export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("contact_messages").insert({
      name: data.name,
      email: data.email,
      message: data.message,
    });
    if (error) {
      console.error("[contact] insert failed:", error.message);
      throw new Error("Nu am putut trimite mesajul. Încearcă din nou.");
    }

    try {
      const { sendAdminAlert } = await import("@/lib/whatsapp/admin-alerts.server");
      await sendAdminAlert(
        `✉️ *Mesaj nou din formularul de contact*\n\nNume: ${data.name}\nEmail: ${data.email}\n\n${data.message}`,
      );
    } catch (e) {
      console.error("[contact] admin alert failed:", e);
    }

    return { ok: true as const };
  });
