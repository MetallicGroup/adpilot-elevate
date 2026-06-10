export type WhatsAppIntent =
  | "create_campaign"
  | "modify_campaign"
  | "launch_campaign"
  | "pause_campaign"
  | "change_budget"
  | "get_report"
  | "get_leads"
  | "upload_creative"
  | "connect_platform"
  | "greeting"
  | "unknown";

export function detectIntent(message: string): WhatsAppIntent {
  const m = message.toLowerCase().trim();

  if (/^(salut|bună|hello|hi)\b/.test(m)) return "greeting";
  if (/(vreau|fă-mi|fa-mi|crează|creează|pornește).*(reclam|campanie|anunț)/.test(m)) return "create_campaign";
  if (/(oprește|opreste|pauzează|pauzeaza).*(reclam|campanie)/.test(m)) return "pause_campaign";
  if (/(pornește|porneste|lansează|lanseaza).*(reclam|campanie)/.test(m)) return "launch_campaign";
  if (/(mărește|mareste|scade|schimbă|schimba).*(buget)/.test(m)) return "change_budget";
  if (/(rezultate|raport|performanță|performanta|cheltuit)/.test(m)) return "get_report";
  if (/(lead|lead-uri|clienți|clienti)/.test(m)) return "get_leads";
  if (/(conectează|conecteaza).*(meta|tiktok|cont)/.test(m)) return "connect_platform";

  return "unknown";
}

export function extractCampaignDraftHints(message: string) {
  const m = message.toLowerCase();
  const budgetMatch = m.match(/(\d+)\s*(lei|ron)\s*(pe zi|\/zi|zilnic)?/);
  const cityMatch = m.match(/\bîn\s+([a-zăâîșț]+)|\b([a-zăâîșț]+)\s*\+/i);

  let platform: "meta" | "tiktok" | undefined;
  if (/\bmeta\b|facebook|instagram/.test(m)) platform = "meta";
  if (/\btiktok\b/.test(m)) platform = "tiktok";

  return {
    daily_budget: budgetMatch ? parseInt(budgetMatch[1], 10) : undefined,
    city: cityMatch ? (cityMatch[1] || cityMatch[2]) : undefined,
    platform,
    raw_service: message,
  };
}
