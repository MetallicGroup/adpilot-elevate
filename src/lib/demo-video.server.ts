/**
 * Clipul demo gratuit din onboarding (/start), generat din pozele clientului.
 *
 *   script  → Claude scrie vocea în română (≈16 s) și prompturile, uitându-se la poze
 *   assets  → Nano Banana Pro: prezentatorul în spațiul clientului + 3 poze 4:5;
 *             ElevenLabs: vocea, cu momentul fiecărui cuvânt; Kling Turbo: 2 cadre cinematice
 *   clips   → Kling AI Avatar: prezentatorul vorbește pe voce (buzele urmează audio-ul)
 *   render  → ffmpeg: cadrele cinematice peste avatar + subtitrări cuvânt cu cuvânt
 *   deliver → șablonul `materiale_gata`; materialele pleacă la apăsarea butonului
 *
 * Totul e pas cu pas: `advanceDemo` face ce se poate acum și iese; cronul `demo-tick`
 * îl cheamă în fiecare minut. Starea stă în `onboarding_sessions.demo_job`.
 */
import { spawn } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const BUCKET = "onboarding";
const KIE = "https://api.kie.ai/api/v1/jobs";
const LOCK_MS = 4 * 60 * 1000;
const TASK_TIMEOUT_MS = 20 * 60 * 1000;
const MAX_ERRORS = 4;
export const DELIVERY_TEMPLATE = "materiale_gata";
export const DELIVERY_PAYLOAD = "materiale";

type Word = { w: string; s: number; e: number };
type Task = { id: string; url?: string | null; failed?: boolean; startedAt: number; retries?: number };
type DemoScript = {
  voiceover: string;
  presenter: "female" | "male";
  presenterLook: string;
  avatarPrompt: string;
  brollPrompts: string[];
  imagePrompts: string[];
};
type Job = {
  phase?: "script" | "clips" | "render" | "deliver" | "done";
  script?: DemoScript;
  photoUrls?: string[];
  crops?: string[];
  talkFrame?: Task;
  images?: Task[];
  broll?: Task[];
  voice?: { path: string; duration: number; words: Word[] };
  avatar?: Task;
  errors?: number;
  lastError?: string;
};

// ───────────────────────────── progres pentru ecran ─────────────────────────────

export function demoProgress(status: string, job: Job): { progress: number; step: string | null } {
  if (status === "ready" || status === "delivered") return { progress: 100, step: null };
  if (status === "none" || status === "failed") return { progress: 0, step: null };
  const phase = job?.phase ?? "script";
  if (phase === "script") return { progress: 6, step: "Scriu scenariul și textul în română" };
  if (phase === "clips") {
    if (!job.talkFrame?.url) return { progress: 22, step: "Creez cadrele din pozele tale" };
    if (!job.avatar?.url) {
      const t = job.avatar ? Math.min(1, (Date.now() - job.avatar.startedAt) / (4 * 60 * 1000)) : 0;
      return { progress: Math.round(40 + t * 40), step: "Înregistrez vocea și sincronizez buzele" };
    }
    return { progress: 82, step: "Animez cadrele" };
  }
  return { progress: 92, step: "Montez subtitrările și efectele" };
}

// ───────────────────────────── kie.ai ─────────────────────────────

function kieKey(): string {
  const k = process.env.KIE_API_KEY;
  if (!k) throw new Error("KIE_API_KEY lipsește");
  return k;
}

async function kieCreate(model: string, input: Record<string, unknown>): Promise<Task> {
  const res = await fetch(`${KIE}/createTask`, {
    method: "POST",
    headers: { Authorization: `Bearer ${kieKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input }),
  });
  const json: any = await res.json().catch(() => null);
  const id = json?.data?.taskId;
  if (json?.code !== 200 || !id) throw new Error(`kie ${model}: ${json?.msg ?? res.status}`);
  return { id, startedAt: Date.now() };
}

/** Actualizează un task: url la succes, failed la eșec sau timeout. */
async function kiePoll(t: Task | undefined): Promise<Task | undefined> {
  if (!t || t.url || t.failed) return t;
  const res = await fetch(`${KIE}/recordInfo?taskId=${encodeURIComponent(t.id)}`, {
    headers: { Authorization: `Bearer ${kieKey()}` },
  });
  const json: any = await res.json().catch(() => null);
  const d = json?.data;
  if (d?.state === "success") {
    let url: string | null = null;
    try {
      url = JSON.parse(d.resultJson ?? "{}")?.resultUrls?.[0] ?? null;
    } catch {
      /* ignore */
    }
    return url ? { ...t, url } : { ...t, failed: true };
  }
  if (d?.state === "fail") {
    console.error("[demo] kie task failed", t.id, d.failMsg);
    return { ...t, failed: true };
  }
  if (Date.now() - t.startedAt > TASK_TIMEOUT_MS) return { ...t, failed: true };
  return t;
}

const KEEP_ROOM =
  "Use the reference photo as the exact location: keep the same room, walls, colors, furniture, equipment and light. " +
  "Do not change the layout. Photorealistic, natural light, shot on a modern smartphone. No text, no logos, no watermark.";

function talkFrameInput(script: DemoScript, photoUrls: string[]) {
  return {
    prompt:
      `${KEEP_ROOM} Add ${script.presenterLook}. The person stands in the room, facing the camera at eye level, ` +
      "medium shot from the waist up, friendly natural smile, mouth closed, hands relaxed. Vertical 9:16 smartphone video frame.",
    image_input: photoUrls.slice(0, 3),
    aspect_ratio: "9:16",
    resolution: "1K",
    output_format: "jpg",
  };
}

function imageInput(prompt: string, photoUrl: string) {
  return {
    prompt: `${KEEP_ROOM} ${prompt} Professional advertising photo, 4:5 vertical.`,
    image_input: [photoUrl],
    aspect_ratio: "4:5",
    resolution: "1K",
    output_format: "jpg",
  };
}

function brollInput(prompt: string, cropUrl: string) {
  return {
    prompt: `${prompt} Smooth cinematic camera move, the room stays exactly the same, realistic, no people appear, no text.`,
    image_urls: [cropUrl],
    duration: "5",
    resolution: "720p",
  };
}

function avatarInput(script: DemoScript, imageUrl: string, audioUrl: string) {
  return { image_url: imageUrl, audio_url: audioUrl, prompt: script.avatarPrompt };
}

// ───────────────────────────── storage ─────────────────────────────

async function signedUrl(db: any, path: string, seconds = 60 * 60 * 24): Promise<string> {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, seconds);
  if (error || !data?.signedUrl) throw new Error(`signed url ${path}: ${error?.message}`);
  return data.signedUrl;
}

async function upload(db: any, path: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
}

async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

// ───────────────────────────── ffmpeg ─────────────────────────────

let ffmpegBin: string | null = null;
async function ffmpeg(): Promise<string> {
  if (ffmpegBin) return ffmpegBin;
  // Binarul vine din pachetul `ffmpeg-static`, copiat lângă funcție (traceDeps în vite.config).
  // Îl găsim prin rezolvarea pachetului la rulare, nu printr-un import (bundle-ul ar strica __dirname).
  await import("ffmpeg-static"); // ține pachetul în build (calea din bundle nu e bună, o rezolvăm mai jos)
  const req = createRequire(import.meta.url);
  const src = join(dirname(req.resolve("ffmpeg-static/package.json")), process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  try {
    const st = await stat(src);
    if (st.mode & 0o111) return (ffmpegBin = src);
  } catch {
    /* fall through */
  }
  // Pe unele platforme binarul vine fără drept de execuție → copie în /tmp.
  const dst = join(tmpdir(), "ffmpeg-adpilot");
  await copyFile(src, dst);
  await chmod(dst, 0o755);
  return (ffmpegBin = dst);
}

function run(bin: string, args: string[], env?: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { env: { ...process.env, ...env } });
    let err = "";
    p.stderr.on("data", (d) => {
      err = (err + d.toString()).slice(-4000);
    });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${err.slice(-1500)}`))));
  });
}

/** Font pentru subtitrări: TTF de la Google Fonts (agent simplu → primim TTF, nu WOFF2). */
const CAPTION_FONT = "Archivo Black";
async function ensureFont(dir: string): Promise<void> {
  const file = join(dir, "caption.ttf");
  try {
    await stat(file);
    return;
  } catch {
    /* download */
  }
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(CAPTION_FONT)}`, {
    headers: { "User-Agent": "Mozilla/4.0" },
  }).then((r) => r.text());
  const m = css.match(/url\((https:[^)]+\.ttf)\)/);
  if (!m) throw new Error("font url not found");
  await writeFile(file, await download(m[1]));
}

// ───────────────────────────── subtitrări ─────────────────────────────

function assTime(t: number): string {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}

function assEscape(s: string): string {
  return s.replace(/[{}\\]/g, "").toUpperCase();
}

/** Grupuri de 2–3 cuvinte; cuvântul rostit e galben și puțin mai mare. */
export function buildAss(words: Word[]): string {
  const chunks: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    const chars = cur.reduce((n, x) => n + x.w.length, 0);
    if (cur.length >= 3 || chars >= 16 || /[.,!?;:]$/.test(w.w)) {
      chunks.push(cur);
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur);

  const lines: string[] = [];
  for (const chunk of chunks) {
    chunk.forEach((w, i) => {
      const end = i < chunk.length - 1 ? chunk[i + 1].s : w.e + 0.08;
      const text = chunk
        .map((x, j) =>
          j === i
            ? `{\\c&H003DD9FF&\\fscx112\\fscy112}${assEscape(x.w)}{\\c&H00FFFFFF&\\fscx100\\fscy100}`
            : assEscape(x.w),
        )
        .join(" ");
      lines.push(`Dialogue: 0,${assTime(w.s)},${assTime(Math.max(end, w.s + 0.12))},Cap,,0,0,0,,${text}`);
    });
  }
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 720",
    "PlayResY: 1280",
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Cap,${CAPTION_FONT},64,&H00FFFFFF,&H00FFFFFF,&H00000000,&H78000000,0,0,0,0,100,100,0,0,1,5,3,2,50,50,300,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...lines,
    "",
  ].join("\n");
}

// ───────────────────────────── ElevenLabs ─────────────────────────────

export async function synthesizeVoice(text: string, presenter: "female" | "male"): Promise<{ mp3: Uint8Array; words: Word[]; duration: number }> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY lipsește");
  const voice =
    presenter === "male"
      ? process.env.ELEVENLABS_VOICE_MALE || "pNInz6obpgDQGcFmaJgB"
      : process.env.ELEVENLABS_VOICE_FEMALE || "EXAVITQu4vr4xnSDxMaL";
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
      }),
    },
  );
  const json: any = await res.json().catch(() => null);
  if (!res.ok || !json?.audio_base64) throw new Error(`elevenlabs ${res.status}: ${JSON.stringify(json)?.slice(0, 200)}`);

  const a = json.alignment ?? json.normalized_alignment ?? {};
  const chars: string[] = a.characters ?? [];
  const st: number[] = a.character_start_times_seconds ?? [];
  const en: number[] = a.character_end_times_seconds ?? [];
  const words: Word[] = [];
  let w = "";
  let ws = 0;
  let we = 0;
  chars.forEach((c, i) => {
    if (/\s/.test(c)) {
      if (w) words.push({ w, s: ws, e: we });
      w = "";
      return;
    }
    if (!w) ws = st[i] ?? 0;
    w += c;
    we = en[i] ?? ws;
  });
  if (w) words.push({ w, s: ws, e: we });
  const duration = en.length ? en[en.length - 1] : 0;
  return { mp3: Uint8Array.from(Buffer.from(json.audio_base64, "base64")), words, duration };
}

// ───────────────────────────── scenariul ─────────────────────────────

const GOAL_CTA: Record<string, string> = {
  calls: "îndeamnă omul să sune",
  forms: "îndeamnă omul să lase numărul de telefon în formular",
  web: "îndeamnă omul să intre pe site",
  shop: "îndeamnă omul să comande online",
};

async function writeScript(niche: string, goal: string | null, photoUrls: string[]): Promise<DemoScript> {
  const { generateText } = await import("ai");
  const { chatModel } = await import("@/lib/llm.server");
  const instructions = `Ești copywriter de reclame video scurte (Reels/TikTok) pentru afaceri locale din România.
Afacerea: ${niche}. Pozele atașate sunt din locul real al afacerii.

Scrie scenariul unui clip vertical de ~16 secunde în care UN prezentator vorbește direct la cameră, în spațiul din poze.
Reguli pentru „voiceover” (textul rostit, în română):
- 34–42 de cuvinte, cu diacritice corecte (ă, â, î, ș, ț), fără emoji, fără hashtag-uri, numerele scrise în litere;
- prima propoziție e o întrebare care oprește scroll-ul, legată de problema clientului;
- vorbește la persoana întâi plural („la noi”), cald și natural, ca un om, nu ca o reclamă la radio;
- nu inventa nume de firmă, prețuri, reduceri sau garanții; fără promisiuni medicale sau „cel mai bun”;
- ultima propoziție ${goal ? GOAL_CTA[goal] ?? "îndeamnă omul să ne contacteze" : "îndeamnă omul să ne contacteze"}.

Restul câmpurilor sunt în ENGLEZĂ (pentru modelele de imagine/video):
- presenter: "female" sau "male", ce se potrivește afacerii;
- presenterLook: descrierea prezentatorului (vârstă 25–40, ținută potrivită afacerii, ex. "a friendly Romanian woman in her early 30s wearing teal medical scrubs");
- avatarPrompt: cum vorbește prezentatorul (expresii, gesturi mici, cameră fixă);
- brollPrompts: 2 mișcări de cameră cinematice prin spațiul din poze, fără oameni;
- imagePrompts: 3 idei de poze publicitare în acest spațiu (ex. specialistul lucrând, un detaliu de aproape, clientul mulțumit).

Răspunde DOAR cu JSON valid:
{"voiceover":"...","presenter":"female","presenterLook":"...","avatarPrompt":"...","brollPrompts":["...","..."],"imagePrompts":["...","...","..."]}`;

  const { text } = await generateText({
    model: chatModel(),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: instructions },
          ...photoUrls.slice(0, 3).map((u) => ({ type: "image" as const, image: new URL(u) })),
        ],
      },
    ],
  });
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("script: no JSON");
  const j = JSON.parse(m[0]);
  const arr = (x: unknown, n: number) =>
    (Array.isArray(x) ? x : []).filter((s): s is string => typeof s === "string" && !!s.trim()).slice(0, n);
  const script: DemoScript = {
    voiceover: String(j.voiceover ?? "").replace(/\s+/g, " ").trim(),
    presenter: j.presenter === "male" ? "male" : "female",
    presenterLook: String(j.presenterLook ?? "a friendly person in their early 30s in work clothes"),
    avatarPrompt:
      String(j.avatarPrompt ?? "").trim() ||
      "The person talks warmly to the camera with natural expressions and small hand gestures. Static camera.",
    brollPrompts: arr(j.brollPrompts, 2),
    imagePrompts: arr(j.imagePrompts, 3),
  };
  if (script.voiceover.split(" ").length < 15) throw new Error("script: voiceover too short");
  while (script.brollPrompts.length < 2) script.brollPrompts.push("Slow dolly-in through the room.");
  while (script.imagePrompts.length < 3) script.imagePrompts.push("A specialist working in this space, smiling.");
  return script;
}

// ───────────────────────────── pașii ─────────────────────────────

/** Taie poza la 9:16 (720×1280) pentru cadrele Kling. */
async function cropVertical(bytes: Uint8Array, work: string, i: number): Promise<Uint8Array> {
  const bin = await ffmpeg();
  const inp = join(work, `p${i}`);
  const out = join(work, `c${i}.jpg`);
  await writeFile(inp, bytes);
  await run(bin, [
    "-y",
    "-i",
    inp,
    "-vf",
    "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
    "-frames:v",
    "1",
    "-q:v",
    "3",
    out,
  ]);
  return new Uint8Array(await readFile(out));
}

async function stepScript(db: any, s: any, job: Job): Promise<void> {
  const uid = s.user_id as string;
  const photoPaths: string[] = (s.photo_paths ?? []).slice(0, 3);
  const photoUrls = await Promise.all(photoPaths.map((p) => signedUrl(db, p)));
  const script = job.script ?? (await writeScript(s.niche ?? "afacere locală", s.goal, photoUrls));
  job.script = script;
  job.photoUrls = photoUrls;

  const work = await mkdtemp(join(tmpdir(), "demo-"));
  try {
    const crops: string[] = [];
    for (let i = 0; i < Math.min(2, photoUrls.length); i++) {
      const c = await cropVertical(await download(photoUrls[i]), work, i);
      const path = `${uid}/demo/crop_${i}.jpg`;
      await upload(db, path, c, "image/jpeg");
      crops.push(await signedUrl(db, path));
    }
    job.crops = crops;
  } finally {
    await rm(work, { recursive: true, force: true });
  }

  const voice = await synthesizeVoice(script.voiceover, script.presenter);
  const voicePath = `${uid}/demo/voice.mp3`;
  await upload(db, voicePath, voice.mp3, "audio/mpeg");
  job.voice = { path: voicePath, duration: voice.duration, words: voice.words };

  job.talkFrame = await kieCreate("nano-banana-pro", talkFrameInput(script, photoUrls));
  job.images = await Promise.all(
    script.imagePrompts.map((p, i) => kieCreate("nano-banana-pro", imageInput(p, photoUrls[i % photoUrls.length]))),
  );
  const crops = job.crops!;
  job.broll = await Promise.all(
    script.brollPrompts.map((p, i) => kieCreate("kling/v3-turbo-image-to-video", brollInput(p, crops[i % crops.length]))),
  );
  job.phase = "clips";
}

async function stepClips(db: any, s: any, job: Job): Promise<void> {
  const script = job.script!;
  job.talkFrame = await kiePoll(job.talkFrame);
  if (job.talkFrame?.failed) {
    if ((job.talkFrame.retries ?? 0) >= 1) throw new Error("talk frame failed");
    job.talkFrame = { ...(await kieCreate("nano-banana-pro", talkFrameInput(script, job.photoUrls!))), retries: 1 };
  }
  if (job.talkFrame?.url && !job.avatar) {
    const audio = await signedUrl(db, job.voice!.path);
    job.avatar = await kieCreate("kling/ai-avatar-standard", avatarInput(script, job.talkFrame.url, audio));
  }
  job.avatar = await kiePoll(job.avatar);
  if (job.avatar?.failed) {
    if ((job.avatar.retries ?? 0) >= 1) throw new Error("avatar failed");
    const audio = await signedUrl(db, job.voice!.path);
    job.avatar = { ...(await kieCreate("kling/ai-avatar-standard", avatarInput(script, job.talkFrame!.url!, audio))), retries: 1 };
  }
  job.images = await Promise.all((job.images ?? []).map((t) => kiePoll(t))) as Task[];
  job.broll = await Promise.all((job.broll ?? []).map((t) => kiePoll(t))) as Task[];

  const settled = (t?: Task) => !!t && (!!t.url || !!t.failed);
  if (job.avatar?.url && (job.images ?? []).every(settled) && (job.broll ?? []).every(settled)) job.phase = "render";
}

/**
 * Montajul: avatarul (cu vocea) ca bază, cadrele cinematice peste el câte 3 s,
 * subtitrări cuvânt cu cuvânt. Întoarce calea fișierului mp4 din `work`.
 */
export async function renderDemoVideo(params: {
  work: string;
  avatarFile: string;
  brollFiles: string[];
  words: Word[];
  duration: number;
}): Promise<string> {
  const { work } = params;
  const bin = await ffmpeg();
  const fontDir = join(work, "fonts");
  await mkdir(fontDir, { recursive: true });
  await ensureFont(fontDir);
  const fcConf = join(work, "fonts.conf");
  await writeFile(
    fcConf,
    `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${fontDir}</dir><cachedir>${join(work, "fc")}</cachedir></fontconfig>`,
  );
  const assFile = join(work, "caps.ass");
  await writeFile(assFile, buildAss(params.words));

  // Cadrele cinematice acoperă avatarul câte 3 s, după cârlig și înainte de final; vocea continuă.
  const dur = Math.max(params.duration, 6);
  const slots = params.brollFiles.length >= 2 && dur >= 12 ? [0.3, 0.58] : params.brollFiles.length ? [0.45] : [];
  const norm = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1";
  const filters: string[] = [`[0:v]${norm},fps=30[v0]`];
  let last = "v0";
  slots.forEach((frac, i) => {
    const t0 = +(dur * frac).toFixed(2);
    filters.push(`[${i + 1}:v]${norm},fps=30,trim=0:3,setpts=PTS-STARTPTS+${t0}/TB[b${i}]`);
    filters.push(`[${last}][b${i}]overlay=enable='between(t,${t0},${+(t0 + 3).toFixed(2)})':eof_action=pass[v${i + 1}]`);
    last = `v${i + 1}`;
  });
  filters.push(`[${last}]ass=${assFile}:fontsdir=${fontDir}[vout]`);

  const out = join(work, "clip.mp4");
  await run(
    bin,
    [
      "-y",
      "-i",
      params.avatarFile,
      ...params.brollFiles.slice(0, slots.length).flatMap((f) => ["-i", f]),
      "-filter_complex",
      filters.join(";"),
      "-map",
      "[vout]",
      "-map",
      "0:a?",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "22",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "-t",
      (dur + 0.4).toFixed(2),
      out,
    ],
    { FONTCONFIG_FILE: fcConf },
  );
  return out;
}

async function stepRender(db: any, s: any, job: Job): Promise<void> {
  const uid = s.user_id as string;
  const work = await mkdtemp(join(tmpdir(), "render-"));
  try {
    const avatarFile = join(work, "avatar.mp4");
    await writeFile(avatarFile, await download(job.avatar!.url!));
    const brollFiles: string[] = [];
    for (const [i, t] of (job.broll ?? []).filter((x) => x.url).entries()) {
      const f = join(work, `b${i}.mp4`);
      await writeFile(f, await download(t.url!));
      brollFiles.push(f);
    }
    const out = await renderDemoVideo({
      work,
      avatarFile,
      brollFiles,
      words: job.voice!.words,
      duration: job.voice!.duration,
    });
    const videoPath = `${uid}/demo/clip.mp4`;
    await upload(db, videoPath, new Uint8Array(await readFile(out)), "video/mp4");

    const imagePaths: string[] = [];
    for (const [i, t] of (job.images ?? []).entries()) {
      if (!t.url) continue;
      const p = `${uid}/demo/image_${i}.jpg`;
      await upload(db, p, await download(t.url), "image/jpeg");
      imagePaths.push(p);
    }

    const now = new Date().toISOString();
    await db
      .from("onboarding_sessions")
      .update({ demo_video_path: videoPath, demo_image_paths: imagePaths, demo_status: "ready", demo_ready_at: now })
      .eq("user_id", uid);
    s.demo_status = "ready";
    job.phase = "deliver";
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function stepDeliver(db: any, s: any, job: Job): Promise<void> {
  const { getCentralWhatsApp, sendWhatsAppTemplate } = await import("./whatsapp.server");
  const central = getCentralWhatsApp();
  if (!central) throw new Error("WhatsApp central lipsește");
  const { data: wa } = await db
    .from("whatsapp_connections")
    .select("user_phone")
    .eq("user_id", s.user_id)
    .eq("status", "active")
    .maybeSingle();
  const phone = String(wa?.user_phone ?? "").replace(/\D/g, "");
  if (!phone) throw new Error("fără număr WhatsApp");
  await sendWhatsAppTemplate(
    central.phoneNumberId,
    central.accessToken,
    phone,
    DELIVERY_TEMPLATE,
    "ro",
    [String(s.niche ?? "afacerea ta").toLowerCase()],
    undefined,
    [{ subType: "quick_reply", index: 0, param: { type: "payload", payload: DELIVERY_PAYLOAD } }],
  );
  await db.from("onboarding_sessions").update({ template_sent_at: new Date().toISOString() }).eq("user_id", s.user_id);
  job.phase = "done";
}

/**
 * Avansează clipul unui user cât se poate acum. Sigur la apeluri simultane (lock în DB).
 */
export async function advanceDemo(db: any, userId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const { data: locked } = await db
    .from("onboarding_sessions")
    .update({ demo_lock_until: new Date(Date.now() + LOCK_MS).toISOString() })
    .eq("user_id", userId)
    .in("demo_status", ["queued", "running", "ready"])
    .or(`demo_lock_until.is.null,demo_lock_until.lt.${nowIso}`)
    .select("*");
  const s = locked?.[0];
  if (!s) return;
  if (s.demo_status === "ready" && s.template_sent_at) {
    await db.from("onboarding_sessions").update({ demo_lock_until: null }).eq("user_id", userId);
    return;
  }

  const job: Job = { ...(s.demo_job ?? {}) };
  if (!job.phase) job.phase = "script";
  let failed = false;
  try {
    if (s.demo_status === "queued") {
      await db.from("onboarding_sessions").update({ demo_status: "running" }).eq("user_id", userId);
      s.demo_status = "running";
    }
    if (job.phase === "script") await stepScript(db, s, job);
    if (job.phase === "clips") await stepClips(db, s, job);
    if (job.phase === "render") await stepRender(db, s, job);
    if (job.phase === "deliver") await stepDeliver(db, s, job);
  } catch (e) {
    job.errors = (job.errors ?? 0) + 1;
    job.lastError = (e as Error).message.slice(0, 500);
    console.error("[demo]", userId, job.phase, job.lastError);
    failed = job.errors >= MAX_ERRORS && job.phase !== "deliver";
  } finally {
    await db
      .from("onboarding_sessions")
      .update({
        demo_job: job,
        demo_lock_until: null,
        ...(failed ? { demo_status: "failed", demo_error: job.lastError } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }
}

/** Cron: avansează toate clipurile în lucru (și trimite șablonul celor gata). */
export async function tickDemos(): Promise<{ processed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data: rows } = await db
    .from("onboarding_sessions")
    .select("user_id, demo_status, template_sent_at")
    .in("demo_status", ["queued", "running", "ready"])
    .order("demo_started_at", { ascending: true })
    .limit(10);
  const todo = (rows ?? []).filter((r: any) => r.demo_status !== "ready" || !r.template_sent_at);
  for (const r of todo) await advanceDemo(db, r.user_id);
  return { processed: todo.length };
}

// ───────────────────────────── livrarea pe WhatsApp ─────────────────────────────

const TARGET_NAMES: Record<string, string> = { fb: "Facebook și Instagram", tt: "TikTok" };

/**
 * Omul a apăsat „Trimite-mi materialele” (fereastra de 24h e deschisă): clipul,
 * pozele și întrebarea cu butoane. Întoarce false dacă nu are materiale gata.
 */
export async function deliverDemoMaterials(
  db: any,
  params: { userId: string; connectionId: string; toPhone: string },
): Promise<boolean> {
  const { data: s } = await db.from("onboarding_sessions").select("*").eq("user_id", params.userId).maybeSingle();
  if (!s?.demo_video_path || !["ready", "delivered"].includes(s.demo_status)) return false;
  const { getCentralWhatsApp, sendWhatsAppMessage } = await import("./whatsapp.server");
  const central = getCentralWhatsApp();
  if (!central) return false;

  const log = async (id: string, msgType: string, text: string | null, mediaPath?: string, mime?: string) => {
    await db.from("whatsapp_messages").insert({
      user_id: params.userId,
      connection_id: params.connectionId,
      wa_message_id: id,
      direction: "out",
      msg_type: msgType,
      text,
      media_path: mediaPath ?? null,
      media_mime: mime ?? null,
      meta: { kind: "demo_materials" },
    });
  };

  // Copie în `wa-media`, unde agentul caută media pentru campanie.
  await copyToWaMedia(db, s.demo_video_path, demoWaPath(params.userId, "clip.mp4"), "video/mp4");
  for (const [i, p] of (s.demo_image_paths ?? []).entries()) {
    await copyToWaMedia(db, p, demoWaPath(params.userId, `image_${i}.jpg`), "image/jpeg");
  }

  const week = 60 * 60 * 24 * 7;
  const video = await signedUrl(db, s.demo_video_path, week);
  const v = await sendWhatsAppMessage(central.phoneNumberId, central.accessToken, params.toPhone, {
    type: "video_link",
    url: video,
    caption: "🎬 Clipul tău",
  });
  await log(v.id, "video", "Clipul tău (demo)");
  for (const p of s.demo_image_paths ?? []) {
    const r = await sendWhatsAppMessage(central.phoneNumberId, central.accessToken, params.toPhone, {
      type: "image_link",
      url: await signedUrl(db, p, week),
    });
    await log(r.id, "image", "Poză (demo)");
  }

  const targets: string[] = s.targets?.length ? s.targets : ["fb"];
  const conn =
    targets.length === 2
      ? "Conturile tale de Facebook, Instagram și TikTok sunt deja conectate."
      : `Contul tău de ${TARGET_NAMES[targets[0]] ?? "Facebook"} e deja conectat.`;
  const q = `Vrei să pornesc și o reclamă cu ele? ${conn}`;
  const b = await sendWhatsAppMessage(central.phoneNumberId, central.accessToken, params.toPhone, {
    type: "buttons",
    text: q,
    buttons: [
      { id: "demo_ad_yes", title: "Da, pornim" },
      { id: "demo_ad_no", title: "Nu acum" },
    ],
  });
  await log(b.id, "interactive", q);
  await db
    .from("onboarding_sessions")
    .update({ demo_status: "delivered", delivered_at: new Date().toISOString() })
    .eq("user_id", params.userId);
  return true;
}

function demoWaPath(userId: string, name: string): string {
  return `demo/${userId}/${name}`;
}

async function copyToWaMedia(db: any, from: string, to: string, contentType: string): Promise<void> {
  const { data, error } = await db.storage.from(BUCKET).download(from);
  if (error || !data) throw new Error(`copy ${from}: ${error?.message}`);
  const bytes = new Uint8Array(await data.arrayBuffer());
  const { error: upErr } = await db.storage.from("wa-media").upload(to, bytes, { contentType, upsert: true });
  if (upErr) throw new Error(`copy ${to}: ${upErr.message}`);
}

/** Context pentru agent: ce știm deja din onboarding, ca să nu mai întrebe. */
export async function onboardingHint(db: any, userId: string): Promise<string | null> {
  const { data: s } = await db
    .from("onboarding_sessions")
    .select("niche, goal, targets, demo_status, delivered_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!s?.niche) return null;
  const goalText: Record<string, string> = {
    calls: "apeluri (reclamă cu buton de sunat / formular cu telefon)",
    forms: "formulare completate (lead form)",
    web: "vizite pe site (trafic)",
    shop: "vânzări în magazinul online",
  };
  const t = (s.targets ?? []).map((x: string) => TARGET_NAMES[x]).filter(Boolean).join(" + ") || "Facebook și Instagram";
  const lines = [
    "ONBOARDING (datele deja date de client — NU le mai cere):",
    `- Afacerea: ${s.niche}`,
    `- Obiectiv: ${s.goal ? goalText[s.goal] : "nespecificat — întreabă scurt"}`,
    `- Platforme alese pentru reclame: ${t}`,
  ];
  if (s.demo_status === "delivered") {
    lines.push(
      "- I-am trimis deja pe WhatsApp clipul demo și pozele generate. Dacă răspunde „Da, pornim”, întreabă pe rând: orașul/zona, vârsta clientului ideal, apoi ce folosim în reclamă (clipul din chat, pozele din chat sau altceva). Clipul din chat e media disponibilă pentru campanie.",
    );
  }
  return lines.join("\n");
}

/** Media pentru campanie din materialele demo (clip sau prima poză, în `wa-media`), dacă au fost livrate recent. */
export async function demoCreativeMedia(
  db: any,
  userId: string,
  preferImage: boolean,
): Promise<{ path: string; mime: string; signedUrl: string } | null> {
  const { data: s } = await db
    .from("onboarding_sessions")
    .select("demo_status, delivered_at, demo_image_paths")
    .eq("user_id", userId)
    .maybeSingle();
  if (s?.demo_status !== "delivered" || !s.delivered_at) return null;
  if (Date.now() - new Date(s.delivered_at).getTime() > 7 * 86400_000) return null;
  const image = preferImage && (s.demo_image_paths ?? []).length > 0;
  const path = demoWaPath(userId, image ? "image_0.jpg" : "clip.mp4");
  const { data } = await db.storage.from("wa-media").createSignedUrl(path, 60 * 60 * 24 * 7);
  if (!data?.signedUrl) return null;
  return { path, mime: image ? "image/jpeg" : "video/mp4", signedUrl: data.signedUrl };
}
