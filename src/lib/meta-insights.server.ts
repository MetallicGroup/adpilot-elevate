import { metaApiVersion } from "./meta.server";

const GRAPH = "https://graph.facebook.com";

export type MetaInsightsSnapshot = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  leads: number;
  cpl: number;
};

export async function fetchCampaignInsights(
  metaCampaignId: string,
  accessToken: string,
): Promise<MetaInsightsSnapshot> {
  const url = new URL(`${GRAPH}/${metaApiVersion()}/${metaCampaignId}/insights`);
  // `account_currency` ne spune valuta contului → convertim cheltuiala în lei.
  url.searchParams.set("fields", "spend,impressions,clicks,ctr,actions,account_currency");
  url.searchParams.set("date_preset", "maximum");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `Meta insights failed (${res.status})`);
  const row = json?.data?.[0];
  if (!row) return { spend: 0, impressions: 0, clicks: 0, ctr: 0, leads: 0, cpl: 0 };
  let spend = Number(row.spend ?? 0);
  const impressions = Number(row.impressions ?? 0);
  const clicks = Number(row.clicks ?? 0);
  const ctr = Number(row.ctr ?? 0);
  const actions: Array<{ action_type: string; value: string }> = row.actions ?? [];
  const leadAction = actions.find(
    (a) => a.action_type === "lead" || a.action_type === "leadgen.other",
  );
  const leads = leadAction ? Number(leadAction.value) : 0;

  // Cheltuiala vine în valuta contului. O convertim în LEI pentru afișare/stocare,
  // ca „Cheltuit X lei" să fie corect și pentru conturile pe USD/EUR etc.
  const currency = String(row.account_currency ?? "RON").toUpperCase();
  if (currency !== "RON" && spend > 0) {
    const { currencyToRon } = await import("./currency.server");
    spend = await currencyToRon(spend, currency);
  }
  const cpl = leads > 0 ? spend / leads : 0;
  return { spend, impressions, clicks, ctr, leads, cpl };
}