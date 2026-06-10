export type MetaBusinessDetails = {
  business_name: string;
  service_product: string;
  location: string;
  target_audience: string;
  daily_budget: number;
  duration_days: number;
  phone: string;
  website?: string;
};

export type MetaGeneratedContent = {
  campaign_name: string;
  primary_text: string;
  headline: string;
  description: string;
  call_to_action: "SIGN_UP" | "LEARN_MORE";
  lead_form_questions: string[];
  targeting_suggestion: {
    countries: string[];
    age_min: number;
    age_max: number;
  };
};

export type MetaLeadFieldInput = {
  key: string;
  label: string;
  customQuestion?: string;
};

export type MetaCampaignLaunchInput = {
  ad_account_uuid: string;
  page_id: string;
  business_details: MetaBusinessDetails;
  generated: MetaGeneratedContent;
  privacy_policy_url: string;
  launch_active?: boolean;
  lead_fields?: MetaLeadFieldInput[];
  creative_urls?: string[];
};

export type MetaAdAccountRow = {
  id: string;
  ad_account_id: string;
  account_name: string | null;
  currency: string | null;
  timezone: string | null;
  status: string;
};

export type MetaPage = {
  id: string;
  name: string;
};

export type MetaInsightsSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  cpl: number;
};

export type MetaLeadRow = {
  id: string;
  campaign_id: string | null;
  platform_lead_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  campaign_name?: string | null;
};
