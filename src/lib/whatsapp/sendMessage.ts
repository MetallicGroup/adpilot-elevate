import { getWhatsAppConfig } from "./config.server";

export async function sendWhatsAppMessage(to: string, text: string) {
  const { token, phoneNumberId, configured } = getWhatsAppConfig();
  if (!configured) {
    console.log("[WhatsApp] Not configured — message skipped:", to, text.slice(0, 80));
    return { sent: false, reason: "not_configured" };
  }

  const normalized = to.replace(/\D/g, "");
  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalized,
      type: "text",
      text: { body: text },
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    console.error("[WhatsApp] Send failed:", json);
    throw new Error(json.error?.message ?? "WhatsApp send failed");
  }

  return { sent: true, messageId: json.messages?.[0]?.id };
}
