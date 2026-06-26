// @ts-nocheck
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWhatsAppMessage } from "./sendMessage";

export async function notifyNewLead(
  userId: string,
  lead: {
    platform: string;
    campaignName: string;
    name: string;
    phone: string;
    service: string;
    preferredDate: string;
    leadId: string;
  },
) {
  const { data: phones } = await supabaseAdmin
    .from("user_whatsapp_phones")
    .select("phone")
    .eq("user_id", userId)
    .eq("verified", true);

  if (!phones?.length) return;

  const message = `Lead nou 🎉

Campanie: ${lead.campaignName}
Platformă: ${lead.platform}
Nume: ${lead.name}
Telefon: ${lead.phone}
Serviciu dorit: ${lead.service}
Data preferată: ${lead.preferredDate}

Deschide AdPilot pentru a marca lead-ul ca contactat.`;

  for (const { phone } of phones) {
    try {
      await sendWhatsAppMessage(phone, message);
    } catch (err) {
      console.error("[WhatsApp] Lead notification failed:", err);
    }
  }
}

export async function sendDailyReport(
  userId: string,
  report: { spend: number; leads: number; cpl: number; clicks: number; ctr: number; recommendation: string },
) {
  const { data: phones } = await supabaseAdmin
    .from("user_whatsapp_phones")
    .select("phone")
    .eq("user_id", userId)
    .eq("verified", true);

  if (!phones?.length) return;

  const message = `Raportul tău de azi 📊

Cheltuit: ${report.spend.toFixed(0)} RON
Lead-uri: ${report.leads}
Cost/lead: ${report.cpl.toFixed(0)} RON
Clickuri: ${report.clicks}
CTR: ${report.ctr.toFixed(1)}%

Recomandare AI:
${report.recommendation}`;

  for (const { phone } of phones) {
    try {
      await sendWhatsAppMessage(phone, message);
    } catch (err) {
      console.error("[WhatsApp] Daily report failed:", err);
    }
  }
}