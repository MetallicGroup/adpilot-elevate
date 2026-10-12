/** Client-side referral capture for sales-agent signup links (?ref=Cristian). */

export const REFERRAL_STORAGE_KEY = "adpilot:referral";
export const REFERRAL_COOKIE = "adpilot_referral";

const MAX_LEN = 40;

/** Normalize a referral code from URL / form input. Empty → null. */
export function normalizeReferralCode(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().slice(0, MAX_LEN).replace(/[^\w.\-@+ ]/g, "");
  return cleaned || null;
}

export function getStoredReferral(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeReferralCode(window.localStorage.getItem(REFERRAL_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function storeReferral(code: string | null) {
  if (typeof window === "undefined" || !code) return;
  try {
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
  // Cookie for Facebook redirect OAuth (server callback can read it).
  try {
    document.cookie = `${REFERRAL_COOKIE}=${encodeURIComponent(code)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function clearStoredReferral() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${REFERRAL_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

/** Prefer ?ref=, fall back to utm_campaign when medium/source look like referral/sales. */
export function referralFromSearch(search: {
  ref?: string;
  utm_campaign?: string;
  utm_source?: string;
  utm_medium?: string;
}): string | null {
  const direct = normalizeReferralCode(search.ref);
  if (direct) return direct;
  const src = (search.utm_source ?? "").toLowerCase();
  const med = (search.utm_medium ?? "").toLowerCase();
  if (src === "sales" || src === "referral" || med === "referral" || med === "affiliate") {
    return normalizeReferralCode(search.utm_campaign);
  }
  return null;
}
