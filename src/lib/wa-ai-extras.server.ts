/**
 * Server-only helpers for the WhatsApp agent — OpenAI (Claude nu face imagini/audio):
 *  - generateCreativeImage: text → 1024x1024 JPG salvat în bucket wa-media (gpt-image-1)
 *  - transcribeWaAudio: notă vocală (ogg/mp3/wav) → text românesc (Whisper)
 */

const OPENAI = "https://api.openai.com/v1";

function openaiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  return key;
}

/** Generate a square 1024 image and save bytes to wa-media. Returns { path, mime, signedUrl }. */
export async function generateCreativeImage(
  userId: string,
  prompt: string,
): Promise<{ path: string; mime: string; signedUrl: string }> {
  const r = await fetch(`${OPENAI}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "low",
    }),
  });
  const j: any = await r.json();
  if (!r.ok) {
    throw new Error(j?.error?.message || `image gen failed (${r.status})`);
  }
  const b64: string | undefined = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error("AI nu a returnat o imagine.");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const path = `generated/${userId}/${Date.now()}.jpg`;
  const { error } = await supabaseAdmin.storage
    .from("wa-media")
    .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`Salvare imagine: ${error.message}`);
  const { data: signed } = await supabaseAdmin.storage
    .from("wa-media")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  return { path, mime: "image/jpeg", signedUrl: signed?.signedUrl ?? "" };
}

/** Transcribe a WhatsApp voice note with OpenAI Whisper. `mime` din WA (ex. "audio/ogg; codecs=opus"). */
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
