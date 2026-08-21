/**
 * Meta (Facebook) Pixel — helper client-side. Wrapper sigur peste `window.fbq`
 * (dacă nu e încărcat, apelurile sunt no-op). Base code + PageView sunt în
 * __root.tsx; aici sunt evenimentele standard pe acțiuni.
 */
type Fbq = (...args: unknown[]) => void;

function fbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { fbq?: Fbq }).fbq ?? null;
}

export function fbTrack(event: string, params?: Record<string, unknown>): void {
  const f = fbq();
  if (!f) return;
  try {
    f("track", event, params ?? {});
  } catch {
    /* no-op */
  }
}

export function fbViewContent(name?: string): void {
  fbTrack("ViewContent", name ? { content_name: name } : undefined);
}

export function fbLead(name?: string): void {
  fbTrack("Lead", name ? { content_name: name } : undefined);
}

export function fbCompleteRegistration(): void {
  fbTrack("CompleteRegistration");
}

/** Eveniment custom (nume liber) — pentru audiențe custom de retargeting. */
export function fbTrackCustom(event: string, params?: Record<string, unknown>): void {
  const f = fbq();
  if (!f) return;
  try {
    f("trackCustom", event, params ?? {});
  } catch {
    /* no-op */
  }
}

/** Userul și-a conectat contul de Facebook/Meta (pentru audiența „înscris dar neconectat"). */
export function fbConnectedFacebook(): void {
  fbTrackCustom("ConnectedFacebook");
}
