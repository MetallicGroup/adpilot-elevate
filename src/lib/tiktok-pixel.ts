/**
 * TikTok Pixel — helper client-side (browser).
 *
 * Wrapper sigur peste `window.ttq`: dacă pixelul nu e încă încărcat, apelurile
 * sunt no-op (nu aruncă). PII (email/telefon/id) se trimite HASH-uit SHA-256 pe
 * client, conform cerinței TikTok.
 *
 * DEDUP cu server-side: evenimentele trimise și prin Events API folosesc ACELAȘI
 * `event_id` (ex. `reg_<userId>` pentru CompleteRegistration), ca TikTok să le
 * numere o singură dată.
 */

type Ttq = {
  track?: (event: string, params?: Record<string, unknown>, opts?: { event_id?: string }) => void;
  identify?: (data: Record<string, string>) => void;
};

function ttq(): Ttq | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ttq?: Ttq }).ttq ?? null;
}

async function sha256(v: string): Promise<string> {
  const data = new TextEncoder().encode(v.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Trimite PII hash-uit (pentru matching mai bun). Best-effort. */
export async function tkIdentify(opts: {
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
}): Promise<void> {
  const t = ttq();
  if (!t?.identify) return;
  try {
    const payload: Record<string, string> = {};
    if (opts.email) payload.email = await sha256(opts.email);
    if (opts.phone) payload.phone_number = await sha256(opts.phone.replace(/[^\d+]/g, ""));
    if (opts.externalId) payload.external_id = await sha256(opts.externalId);
    if (Object.keys(payload).length) t.identify(payload);
  } catch {
    /* no-op */
  }
}

/** Wrapper generic peste ttq.track (cu event_id opțional pentru dedup). */
export function tkTrack(
  event: string,
  params?: Record<string, unknown>,
  eventId?: string,
): void {
  const t = ttq();
  if (!t?.track) return;
  try {
    t.track(event, params ?? {}, eventId ? { event_id: eventId } : undefined);
  } catch {
    /* no-op */
  }
}

export function tkViewContent(opts: { contentId?: string; contentName?: string } = {}): void {
  tkTrack("ViewContent", {
    contents: [
      {
        content_id: opts.contentId ?? "page",
        content_type: "product",
        content_name: opts.contentName ?? "",
      },
    ],
  });
}

export function tkClickButton(name: string): void {
  tkTrack("ClickButton", {
    contents: [{ content_id: name, content_type: "product", content_name: name }],
  });
}

/**
 * CompleteRegistration client-side. Folosește `reg_<userId>` ca event_id ca să se
 * deduplice cu evenimentul server-side (Events API) trimis din hook-ul de signup.
 */
export async function tkCompleteRegistration(opts: {
  userId?: string | null;
  email?: string | null;
}): Promise<void> {
  if (opts.email || opts.userId) {
    await tkIdentify({ email: opts.email, externalId: opts.userId });
  }
  tkTrack("CompleteRegistration", {}, opts.userId ? `reg_${opts.userId}` : undefined);
}
