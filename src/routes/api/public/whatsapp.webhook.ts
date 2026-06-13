import { createFileRoute } from "@tanstack/react-router";

/**
 * WhatsApp Cloud API webhook (per-user verify token via DB).
 *  - GET: hub.challenge verification
 *  - POST: receive messages, store, call AI agent
 */
export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode !== "subscribe" || !token) return new Response("Forbidden", { status: 403 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("whatsapp_connections")
          .select("id")
          .eq("verify_token", token)
          .limit(1)
          .maybeSingle();
        if (!data) return new Response("Forbidden", { status: 403 });
        return new Response(challenge ?? "", { status: 200 });
      },

      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-hub-signature-256");
        const appSecret = process.env.META_APP_SECRET;
        if (!appSecret) return new Response("Server misconfigured", { status: 500 });

        const { verifyWaSignature, getWhatsAppMediaUrl, downloadWhatsAppMedia } = await import(
          "@/lib/whatsapp.server"
        );
        const ok = await verifyWaSignature(raw, sig, appSecret);
        if (!ok) return new Response("Invalid signature", { status: 401 });

        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        if (payload?.object !== "whatsapp_business_account") {
          return new Response("ok", { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runWhatsAppAgent } = await import("@/lib/whatsapp-agent.server");

        const entries: any[] = Array.isArray(payload.entry) ? payload.entry : [];
        for (const entry of entries) {
          const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
          for (const change of changes) {
            if (change?.field !== "messages") continue;
            const value = change.value ?? {};
            const phoneNumberId: string | undefined = value?.metadata?.phone_number_id;
            if (!phoneNumberId) continue;

            const { data: conn } = await supabaseAdmin
              .from("whatsapp_connections")
              .select("id, user_id, phone_number_id, access_token")
              .eq("phone_number_id", phoneNumberId)
              .maybeSingle();
            if (!conn) continue;

            const msgs: any[] = Array.isArray(value.messages) ? value.messages : [];
            for (const m of msgs) {
              const fromPhone: string = m.from;
              const waMsgId: string = m.id;
              const type: string = m.type;

              let text: string | null = null;
              let mediaPath: string | null = null;
              let mediaMime: string | null = null;
              let signedUrl: string | null = null;

              if (type === "text") {
                text = m.text?.body ?? "";
              } else if (type === "image" || type === "video" || type === "audio") {
                const mediaId = m[type]?.id as string | undefined;
                if (mediaId) {
                  try {
                    const { url, mime_type } = await getWhatsAppMediaUrl(mediaId, conn.access_token);
                    const bytes = await downloadWhatsAppMedia(url, conn.access_token);
                    const ext = mime_type.split("/")[1]?.split(";")[0] || "bin";
                    const path = `${conn.user_id}/${Date.now()}_${mediaId}.${ext}`;
                    const { error: upErr } = await supabaseAdmin.storage
                      .from("wa-media")
                      .upload(path, bytes, { contentType: mime_type, upsert: false });
                    if (!upErr) {
                      mediaPath = path;
                      mediaMime = mime_type;
                      const { data: signed } = await supabaseAdmin.storage
                        .from("wa-media")
                        .createSignedUrl(path, 60 * 60 * 24 * 7);
                      signedUrl = signed?.signedUrl ?? null;
                    }
                    if (m[type]?.caption) text = m[type].caption;
                  } catch (e) {
                    console.error("[wa] media download failed", e);
                  }
                }
              }

              // Persist incoming
              await supabaseAdmin.from("whatsapp_messages").insert({
                user_id: conn.user_id,
                connection_id: conn.id,
                wa_message_id: waMsgId,
                direction: "in",
                msg_type: type,
                text,
                media_path: mediaPath,
                media_mime: mediaMime,
              });
              await supabaseAdmin
                .from("whatsapp_connections")
                .update({ last_message_at: new Date().toISOString() })
                .eq("id", conn.id);

              // Load history
              const { data: hist } = await supabaseAdmin
                .from("whatsapp_messages")
                .select("direction, text, created_at")
                .eq("user_id", conn.user_id)
                .order("created_at", { ascending: false })
                .limit(30);
              const history = (hist ?? [])
                .reverse()
                .filter((h: any) => h.text)
                .map((h: any) => ({
                  role: (h.direction === "in" ? "user" : "assistant") as "user" | "assistant",
                  content: h.text as string,
                }));
              // Drop last (current msg already included via userMessage)
              if (history.length && history[history.length - 1].role === "user") history.pop();

              const userMessage =
                (text && text.trim()) ||
                (mediaPath ? "[Userul a trimis o imagine/video]" : "[Mesaj fără text]");

              try {
                await runWhatsAppAgent(
                  {
                    userId: conn.user_id,
                    connection: {
                      id: conn.id,
                      phone_number_id: conn.phone_number_id,
                      access_token: conn.access_token,
                    },
                    toPhone: fromPhone,
                    latestMedia:
                      mediaPath && mediaMime && signedUrl
                        ? { path: mediaPath, mime: mediaMime, signedUrl }
                        : null,
                  },
                  history,
                  userMessage,
                );
              } catch (e) {
                console.error("[wa agent] failed", e);
                const { sendWhatsAppMessage } = await import("@/lib/whatsapp.server");
                try {
                  await sendWhatsAppMessage(
                    conn.phone_number_id,
                    conn.access_token,
                    fromPhone,
                    { type: "text", text: "⚠️ Eroare la procesarea mesajului. Încearcă din nou." },
                  );
                } catch {
                  /* ignore */
                }
              }
            }
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});