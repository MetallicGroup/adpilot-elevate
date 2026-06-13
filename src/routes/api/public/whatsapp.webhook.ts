import { createFileRoute } from "@tanstack/react-router";

/**
 * Shared-number WhatsApp webhook (Meta Cloud API).
 * - GET: hub.challenge verification with ADPILOT_WA_VERIFY_TOKEN.
 * - POST: verifies signature, maps sender phone (or activation code in
 *   first message) to a user, persists conversation, runs AI agent.
 */
export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env.ADPILOT_WA_VERIFY_TOKEN;
        if (mode === "subscribe" && token && expected && token === expected) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-hub-signature-256");
        const appSecret = process.env.META_APP_SECRET;
        if (!appSecret) return new Response("Server misconfigured", { status: 500 });

        const {
          verifyWaSignature,
          getWhatsAppMediaUrl,
          downloadWhatsAppMedia,
          getCentralWhatsApp,
          sendWhatsAppMessage,
          normalizePhone,
        } = await import("@/lib/whatsapp.server");

        const ok = await verifyWaSignature(raw, sig, appSecret);
        if (!ok) return new Response("Invalid signature", { status: 401 });

        const central = getCentralWhatsApp();
        if (!central) return new Response("WA not configured", { status: 500 });

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
            const msgs: any[] = Array.isArray(value.messages) ? value.messages : [];

            for (const m of msgs) {
              const fromPhone: string = normalizePhone(m.from);
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
                    const { url, mime_type } = await getWhatsAppMediaUrl(
                      mediaId,
                      central.accessToken,
                    );
                    const bytes = await downloadWhatsAppMedia(url, central.accessToken);
                    const ext = mime_type.split("/")[1]?.split(";")[0] || "bin";
                    const path = `inbox/${fromPhone}/${Date.now()}_${mediaId}.${ext}`;
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

              // Map sender → user
              let { data: conn } = await supabaseAdmin
                .from("whatsapp_connections")
                .select("id, user_id, user_phone, status, activation_code")
                .eq("user_phone", fromPhone)
                .maybeSingle();

              // If unknown phone, try matching by activation code in message text
              if (!conn && text) {
                const codeMatch = text.match(/\b([A-F0-9]{8})\b/i);
                if (codeMatch) {
                  const code = codeMatch[1].toUpperCase();
                  const { data: byCode } = await supabaseAdmin
                    .from("whatsapp_connections")
                    .select("id, user_id, user_phone, status, activation_code")
                    .eq("activation_code", code)
                    .maybeSingle();
                  if (byCode) {
                    // Bind the sender phone to this account
                    await supabaseAdmin
                      .from("whatsapp_connections")
                      .update({ user_phone: fromPhone })
                      .eq("id", byCode.id);
                    conn = { ...byCode, user_phone: fromPhone };
                  }
                }
              }

              if (!conn) {
                // Unknown sender — politely ask them to register on AdPilot
                try {
                  await sendWhatsAppMessage(
                    central.phoneNumberId,
                    central.accessToken,
                    fromPhone,
                    {
                      type: "text",
                      text: "👋 Salut! Acest număr nu e încă legat de un cont AdPilot. Intră în aplicație → Settings → WhatsApp și apasă „Activează asistentul pe WhatsApp”.",
                    },
                  );
                } catch {
                  /* ignore */
                }
                continue;
              }

              const justActivated = conn.status !== "active";

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
                .update({
                  last_message_at: new Date().toISOString(),
                  ...(justActivated
                    ? { status: "active", activated_at: new Date().toISOString() }
                    : {}),
                })
                .eq("id", conn.id);

              // First-time activation → send welcome and stop (don't run agent on the activation msg)
              if (justActivated) {
                try {
                  const welcome =
                    "Salut 👋 Sunt asistentul tău AdPilot. De aici poți primi lead-uri, rapoarte și poți controla campaniile tale direct pe WhatsApp.\n\nScrie-mi: *„arată-mi campaniile”* sau *„vreau o campanie nouă”* 🚀";
                  const { id } = await sendWhatsAppMessage(
                    central.phoneNumberId,
                    central.accessToken,
                    fromPhone,
                    { type: "text", text: welcome },
                  );
                  await supabaseAdmin.from("whatsapp_messages").insert({
                    user_id: conn.user_id,
                    connection_id: conn.id,
                    wa_message_id: id,
                    direction: "out",
                    msg_type: "text",
                    text: welcome,
                  });
                } catch (e) {
                  console.error("[wa] welcome send failed", e);
                }
                continue;
              }

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
                      phone_number_id: central.phoneNumberId,
                      access_token: central.accessToken,
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
                try {
                  await sendWhatsAppMessage(
                    central.phoneNumberId,
                    central.accessToken,
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