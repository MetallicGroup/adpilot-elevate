import process from "node:process";

export function getWhatsAppConfig() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const appUrl = process.env.APP_URL || "https://adpilot.ro";

  return { token, phoneNumberId, verifyToken, appUrl, configured: !!(token && phoneNumberId) };
}
