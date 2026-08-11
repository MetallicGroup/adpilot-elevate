import type { BusinessNiche } from "@/lib/launcher/types";

export type BookingQuestionType =
  | "text"
  | "textarea"
  | "single_select"
  | "multi_select"
  | "yes_no"
  | "number"
  | "date";

export const BOOKING_QUESTION_TYPES: BookingQuestionType[] = [
  "text",
  "textarea",
  "single_select",
  "multi_select",
  "yes_no",
  "number",
  "date",
];

export type BookingQuestion = {
  id?: string;
  key: string;
  label: string;
  type: BookingQuestionType;
  options: string[];
  required: boolean;
  help_text?: string | null;
  position: number;
  source: "preset" | "ai" | "user";
};

export type BookingServiceDraft = {
  id?: string;
  name: string;
  description?: string | null;
  duration_min: number;
  price?: number | null;
  position: number;
};

export type AvailabilityRule = {
  weekday: number; // 0 = duminică
  start_time: string; // "09:00"
  end_time: string; // "18:00"
  slot_min: number;
  buffer_min: number;
};

export type LandingCopy = {
  headline: string;
  subheadline: string;
  offer_label: string;
  benefits: string[];
  about: string;
  faq: Array<{ q: string; a: string }>;
  cta_label: string;
  trust_points: string[];
};

export type BookingAttribution = {
  fbclid?: string;
  fbp?: string;
  fbc?: string;
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  placement?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  user_agent?: string;
  event_source_url?: string;
};

export type BookingLandingData = {
  booking_campaign: {
    id: string;
    slug: string;
    service: string;
    offer: string | null;
    landing_copy: LandingCopy;
    hero_image_url: string | null;
    pixel_id: string | null;
  };
  business: {
    name: string;
    city: string | null;
    phone: string | null;
    logo_url: string | null;
    niche: BusinessNiche | string;
    timezone: string;
    privacy_policy_url: string | null;
  };
  questions: BookingQuestion[];
  services: BookingServiceDraft[];
};