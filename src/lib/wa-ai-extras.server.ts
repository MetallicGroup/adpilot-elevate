/**
 * Server-only helpers built on Lovable AI Gateway for the WhatsApp agent:
 *  - generateCreativeImage: text → 1024x1024 JPG saved în bucket wa-media
 *  - transcribeWaAudio: voice note (ogg/mp3/wav) → text românesc
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

function authHeaders() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

/** Generate a square 1024 image and save bytes to wa-media. Returns { path, mime, signedUrl }. */
export async function generateCreativeImage(
  userId: string,
  prompt: string,
): Promise<{ path: string; mime: string; signedUrl: string }> {
  const body = {
    model: "openai/gpt-image-1-mini",
    prompt,
    n: 1,
    size: "1024x1024",
    quality: "low",
  };
  const r = await fetch(`${GATEWAY}/images/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
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

/** Transcribe a WhatsApp voice note. Pass mime from WA (e.g. "audio/ogg; codecs=opus"). */
export async function transcribeWaAudio(bytes: Uint8Array, mime: string): Promise<string> {
  // Map MIME → format string accepted by chat-completions input_audio
  const raw = mime.toLowerCase();
  let format: "ogg" | "mp3" | "wav" | "m4a" | "webm" = "ogg";
  if (raw.includes("mpeg") || raw.includes("mp3")) format = "mp3";
  else if (raw.includes("wav")) format = "wav";
  else if (raw.includes("mp4") || raw.includes("m4a") || raw.includes("aac")) format = "m4a";
  else if (raw.includes("webm")) format = "webm";

  let b64 = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    b64 += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  b64 = btoa(b64);

  const body = {
    model: "google/gemini-2.5-flash",
    messages: [
      {
        role: "system",
        content:
          "Ești un transcriptor. Returnează DOAR textul exact spus de user, în limba originală (probabil română). Fără explicații, fără ghilimele.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Transcrie acest mesaj vocal:" },
          { type: "input_audio", input_audio: { data: b64, format } },
        ],
      },
    ],
  };
  const r = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const j: any = await r.json();
  if (!r.ok) {
    throw new Error(j?.error?.message || `transcribe failed (${r.status})`);
  }
  const text: string = j?.choices?.[0]?.message?.content ?? "";
  return text.trim();
}
