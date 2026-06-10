import { getWhatsAppConfig } from "@/lib/whatsapp/config.server";
import { handleWhatsAppMessage } from "@/lib/whatsapp/conversation";

type WebhookPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from: string;
          type: string;
          text?: { body: string };
          image?: { id: string };
          video?: { id: string };
        }>;
      };
    }>;
  }>;
};

export async function handleWhatsAppWebhook(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/whatsapp/webhook")) return null;

  const { verifyToken } = getWhatsAppConfig();

  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method === "POST") {
    const body = (await request.json()) as WebhookPayload;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const message of change.value?.messages ?? []) {
          const text = message.text?.body ?? "";
          const mediaUrls: string[] = [];
          if (message.image?.id) mediaUrls.push(`whatsapp-media:${message.image.id}`);
          if (message.video?.id) mediaUrls.push(`whatsapp-media:${message.video.id}`);

          if (text || mediaUrls.length) {
            await handleWhatsAppMessage(message.from, text, mediaUrls);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
}
