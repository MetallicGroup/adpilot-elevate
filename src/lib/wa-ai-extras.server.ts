/**
 * Server-only helpers for the WhatsApp agent (Claude nu face imagini/audio):
 *  - generateCreativeImage: poză 4:5 cu Nano Banana Pro (kie.ai), pornind de la o poză a clientului
 *  - transcribeWaAudio: notă vocală (ogg/mp3/wav) → text românesc (Whisper)
 */

const OPENAI = "https://api.openai.com/v1";

function openaiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  return key;
}

/** Mesajul pentru om când nu avem nicio poză de-a lui de la care să pornim. */
export const NEED_REFERENCE_MESSAGE =
  "Ca să-ți fac o poză cu AI, am nevoie de o poză reală cu afacerea ta ca punct de plecare (locul, produsul sau echipa). Trimite-mi una aici și o fac imediat. 📸";

/** Poza de pornire: cea dată explicit, apoi ultima poză trimisă pe WhatsApp, apoi pozele de la înscriere. */
async function referenceUrl(db: any, userId: string, reference?: { bytes: Uint8Array; mime: string } | null): Promise<string | null> {
  const sign = async (bucket: string, path: string) =>
    (await db.storage.from(bucket).createSignedUrl(path, 60 * 60)).data?.signedUrl ?? null;
  if (reference?.bytes?.length) {
    const path = `refs/${userId}/${Date.now()}.jpg`;
    const { error } = await db.storage.from("wa-media").upload(path, reference.bytes, { contentType: reference.mime || "image/jpeg" });
    if (!error) return sign("wa-media", path);
  }
  const since = new Date(Date.now() - 60 * 86400_000).toISOString();
  const { data: wa } = await db
    .from("whatsapp_messages")
    .select("media_path, media_mime")
    .eq("user_id", userId)
    .eq("direction", "in")
    .like("media_mime", "image/%")
    .not("media_path", "is", null)
    // doar poze reale trimise de om, nu pozele generate anterior (salvate tot ca „in”)
    .not("wa_message_id", "like", "ai-gen-%")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (wa?.media_path) return sign("wa-media", wa.media_path);
  const { data: s } = await db.from("onboarding_sessions").select("photo_paths").eq("user_id", userId).maybeSingle();
  if (s?.photo_paths?.[0]) return sign("onboarding", s.photo_paths[0]);
  return null;
}

/**
 * Poză pentru reclamă cu Nano Banana Pro (kie.ai), pornind MEREU de la o poză reală a clientului,
 * ca locul, produsele și oamenii să rămână recognoscibili. 4:5 vertical, salvată în `wa-media`
 * și în istoricul de materiale. Aruncă `NEED_REFERENCE_MESSAGE` dacă nu are nicio poză.
 */
export async function generateCreativeImage(
  userId: string,
  prompt: string,
  reference?: { bytes: Uint8Array; mime: string } | null,
  opts: { source?: "whatsapp" | "web" } = {},
): Promise<{ path: string; mime: string; signedUrl: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const ref = await referenceUrl(db, userId, reference);
  if (!ref) throw new Error(NEED_REFERENCE_MESSAGE);

  const { kieCreate, kieWait } = await import("./kie.server");
  const task = await kieCreate("nano-banana-pro", {
    prompt:
      "The attached photo shows the client's real business: keep the place, products and people recognizable and photorealistic. " +
      `${prompt} Advertising photo for social media, natural light, vertical 4:5. No watermark.`,
    image_input: [ref],
    aspect_ratio: "4:5",
    resolution: "2K",
    output_format: "jpg",
  });
  const url = await kieWait(task, 150_000);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Nu am putut descărca imaginea generată.");
  const bytes = new Uint8Array(await res.arrayBuffer());

  const path = `generated/${userId}/${Date.now()}.jpg`;
  const { error } = await db.storage.from("wa-media").upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`Salvare imagine: ${error.message}`);
  await db.from("ai_assets").insert({ user_id: userId, kind: "image", bucket: "wa-media", path, source: opts.source ?? "whatsapp", prompt });
  const { data: signed } = await db.storage.from("wa-media").createSignedUrl(path, 60 * 60 * 24 * 7);
  return { path, mime: "image/jpeg", signedUrl: signed?.signedUrl ?? "" };
}

export async function transcribeWaAudio(bytes: Uint8Array, mime: string): Promise<string> {
  const raw = mime.toLowerCase();
  let ext = "ogg";
  if (raw.includes("mpeg") || raw.includes("mp3")) ext = "mp3";
  else if (raw.includes("wav")) ext = "wav";
  else if (raw.includes("mp4") || raw.includes("m4a") || raw.includes("aac")) ext = "m4a";
  else if (raw.includes("webm")) ext = "webm";

  const contentType = raw.split(";")[0]?.trim() || "audio/ogg";
  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart], { type: contentType }), `audio.${ext}`);
  form.append("model", "whisper-1");
  form.append("language", "ro");
  form.append("response_format", "text");

  const r = await fetch(`${OPENAI}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey()}` },
    body: form,
  });
  if (!r.ok) {
    let msg = `transcribe failed (${r.status})`;
    try {
      const j: any = await r.json();
      msg = j?.error?.message || msg;
    } catch {
      /* text response */
    }
    throw new Error(msg);
  }
  // response_format=text → corpul e chiar transcrierea
  const text = await r.text();
  return text.trim();
}
