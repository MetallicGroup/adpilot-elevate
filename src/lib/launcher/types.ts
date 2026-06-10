export type PromotionGoal =
  | "appointments"
  | "leads"
  | "service"
  | "product"
  | "offer"
  | "course";

export type BusinessNiche =
  | "beauty_makeup"
  | "hair_salon"
  | "nails"
  | "fitness"
  | "restaurant"
  | "clinic"
  | "construction"
  | "auto"
  | "ecommerce"
  | "general";

export type LeadFieldKey =
  | "full_name"
  | "phone"
  | "email"
  | "service_interest"
  | "preferred_date"
  | "preferred_time"
  | "budget"
  | "company_name"
  | "address"
  | "custom";

export type LeadFieldConfig = {
  key: LeadFieldKey;
  label: string;
  required: boolean;
  customQuestion?: string;
};

export type LauncherSimpleAnswers = {
  promotion_goal: PromotionGoal;
  niche: BusinessNiche;
  service: string;
  city: string;
  radius_km: number;
  daily_budget: number;
  business_name?: string;
  privacy_policy_url?: string;
};

export type GeneratedAdCopy = {
  campaign_name: string;
  primary_text: string;
  headline: string;
  description: string;
  call_to_action: "SIGN_UP" | "LEARN_MORE" | "BOOK_NOW";
  audience_summary: string;
  lead_form_questions: LeadFieldConfig[];
  whatsapp_followup: string;
  daily_report_template: string;
  targeting_suggestion: {
    countries: string[];
    city: string;
    radius_km: number;
    age_min: number;
    age_max: number;
    interests: string[];
  };
};

export type TechnicalCampaignConfig = {
  meta?: {
    objective: "OUTCOME_LEADS";
    optimization_goal: "LEAD_GENERATION";
    billing_event: "IMPRESSIONS";
    destination: "instant_form";
    status: "PAUSED" | "ACTIVE";
  };
  tiktok?: {
    objective: "LEAD_GENERATION";
    budget_mode: "BUDGET_MODE_DAY";
    status: "draft" | "active";
  };
};

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "appointment_scheduled"
  | "won"
  | "lost";

export const LEAD_STATUSES: Array<{ value: LeadStatus; label: string }> = [
  { value: "new", label: "Nou" },
  { value: "contacted", label: "Contactat" },
  { value: "qualified", label: "Calificat" },
  { value: "appointment_scheduled", label: "Programare stabilită" },
  { value: "won", label: "Câștigat" },
  { value: "lost", label: "Pierdut" },
];
