/**
 * Clipul demo gratuit din onboarding (/start), generat din pozele clientului.
 *
 * Structura (20–25 s, tăieturi la 2–4 s, ca un Reel UGC):
 *   SELFIE (cârligul) │ CAMERA largă │ PLAN MEDIU │ ÎN ACȚIUNE │ PRIM-PLAN │ DETALIU │ SELFIE (îndemnul)
 * Prezentatorul vorbește în 3 unghiuri; unghiurile pornesc din selfie, deci e aceeași persoană.
 * Fiecare unghi primește bucata lui din voce, ca buzele să se potrivească. Vocea întreagă
 * rămâne pe tot clipul, iar tăieturile cad doar între cuvinte.
 *
 *   script  → Claude: textul în română (50–60 de cuvinte) și prompturile, uitându-se la poze;
 *             ElevenLabs: vocea (20–25 s) cu momentul fiecărui cuvânt → planul tăieturilor;
 *             pornesc: selfie-ul (Nano Banana Pro), 3 poze 4:5, 2 cadre din poză (Kling Turbo)
 *   clips   → după selfie: planul mediu, prim-planul și ipostaza în acțiune (selfie-ul ca referință);
 *             pe fiecare cadru gata: Kling AI Avatar pe bucata lui din voce; ipostaza → Kling Turbo
 *   render  → ffmpeg: cadrele lipite pe tăieturi, vocea întreagă, subtitrări cuvânt cu cuvânt
 *   deliver → șablonul `materiale_gata`; materialele pleacă la apăsarea butonului
 *
 * Totul e pas cu pas: `advanceDemo` face ce se poate acum și iese; cronul `demo-tick`
 * (și pagina deschisă) îl cheamă des. Starea stă în `onboarding_sessions.demo_job`.
 */
import { spawn } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { kieCreate, kiePoll, kieRetryTransient, kieWaitingRetry, type KieTask } from "./kie.server";

const BUCKET = "onboarding";
const LOCK_MS = 4 * 60 * 1000;
const MAX_ERRORS = 4;
export const DELIVERY_TEMPLATE = "materiale_gata";
export const DELIVERY_PAYLOAD = "materiale";

type Word = { w: string; s: number; e: number };
type Task = import("./kie.server").KieTask;
type Angle = "selfie" | "medium" | "close";
type BrollSrc = "wide" | "action" | "detail";
type Shot =
  | { kind: "talk"; angle: Angle; t0: number; t1: number; audio?: string }
  | { kind: "broll"; src: BrollSrc; t0: number; t1: number };
type DemoScript = {
  voiceover: string;
  presenter: "female" | "male";
  presenterLook: string;
  avatarPrompt: string;
  actionPrompt: string;
  actionMotion: string;
  /** [cadrul larg, detaliul] — mișcări de cameră prin poza clientului */
  brollPrompts: string[];
  imagePrompts: string[];
  keywords: string[];
};
type Job = {
  phase?: "script" | "clips" | "render" | "deliver" | "done";
  script?: DemoScript;
  photoUrls?: string[];
  crops?: string[];
  cropPaths?: string[];
  voice?: { path: string; duration: number; words: Word[] };
  plan?: Shot[];
  frames?: Partial<Record<Angle | "action", Task>>;
  /** cheia = indexul cadrului din plan */
  avatars?: Record<string, Task>;
  broll?: Partial<Record<BrollSrc, Task>>;
  images?: Task[];
  errors?: number;
  lastError?: string;
};

// ───────────────────────────── planul tăieturilor ─────────────────────────────

const ORDER: Array<{ kind: "talk"; angle: Angle; w: number } | { kind: "broll"; src: BrollSrc }> = [
  { kind: "talk", angle: "selfie", w: 1 },
  { kind: "broll", src: "wide" },
  { kind: "talk", angle: "medium", w: 1.1 },
  { kind: "broll", src: "action" },
  { kind: "talk", angle: "close", w: 1.1 },
  { kind: "broll", src: "detail" },
  { kind: "talk", angle: "selfie", w: 0.9 },
];
const BROLL_SEC = 2.4;

/** Împarte vocea în cadre; tăieturile cad în pauzele dintre cuvinte. */
export function planShots(words: Word[], duration: number): Shot[] {
  const D = duration;
  const talkTotal = Math.max(D - BROLL_SEC * 3, 6);
  const wsum = ORDER.reduce((n, o) => n + (o.kind === "talk" ? o.w : 0), 0);
  let t = 0;
  let ends = ORDER.map((o) => (t += o.kind === "broll" ? BROLL_SEC : (talkTotal * o.w) / wsum));
  ends = ends.map((e) => (e * D) / t);

  const gaps = words.slice(0, -1).map((w, i) => (w.e + words[i + 1].s) / 2);
  // Cârligul se termină la sfârșitul primei propoziții, dacă pică între 2,2 și 4,8 s.
  const firstEnd = words.findIndex((w) => /[?.!]$/.test(w.w));
  if (firstEnd >= 0 && gaps[firstEnd] !== undefined && gaps[firstEnd] >= 2.2 && gaps[firstEnd] <= 4.8) {
    ends[0] = gaps[firstEnd];
  }
  for (let i = 1; i < ends.length - 1; i++) {
    let best = ends[i];
    let dist = 0.7;
    for (const g of gaps) {
      if (Math.abs(g - ends[i]) < dist) {
        dist = Math.abs(g - ends[i]);
        best = g;
      }
    }
    ends[i] = best;
  }
  ends[ends.length - 1] = D;
  for (let i = 0; i < ends.length; i++) {
    const prev = i ? ends[i - 1] : 0;
    if (ends[i] < prev + 1.2) ends[i] = Math.min(prev + 1.2, D);
  }

  return ORDER.map((o, i) => {
    const t0 = +(i ? ends[i - 1] : 0).toFixed(2);
    const t1 = +ends[i].toFixed(2);
    return o.kind === "talk" ? { kind: "talk", angle: o.angle, t0, t1 } : { kind: "broll", src: o.src, t0, t1 };
  });
}

// ───────────────────────────── progres pentru ecran ─────────────────────────────

export function demoProgress(status: string, job: Job): { progress: number; step: string | null } {
  if (status === "ready" || status === "delivered") return { progress: 100, step: null };
  if (status === "none" || status === "failed") return { progress: 0, step: null };
  const phase = job?.phase ?? "script";
  if (phase === "script") return { progress: 6, step: "Scriu scenariul și textul în română" };
  if (phase === "clips") {
    const settled = (x?: Task) => !!x && (!!x.url || !!x.failed);
    const talks = (job.plan ?? []).filter((s) => s.kind === "talk").length || 4;
    const parts = [
      ...(["selfie", "medium", "close", "action"] as const).map((k) => settled(job.frames?.[k])),
      ...Object.values(job.avatars ?? {}).map(settled),
      ...Array.from({ length: Math.max(0, talks - Object.keys(job.avatars ?? {}).length) }, () => false),
      ...(["wide", "detail", "action"] as const).map((k) => settled(job.broll?.[k])),
      ...(job.images ?? []).map(settled),
    ];
    const done = parts.filter(Boolean).length / Math.max(parts.length, 1);
    const step = !job.frames?.selfie?.url
      ? "Creez cadrele din pozele tale"
      : Object.values(job.avatars ?? {}).filter((a) => a.url).length < talks
        ? "Înregistrez vocea și sincronizez buzele"
        : "Animez cadrele";
    return { progress: Math.round(15 + done * 72), step };
  }
  return { progress: 92, step: "Montez subtitrările și efectele" };
}

// ───────────────────────────── kie.ai: prompturi ─────────────────────────────

const ROOM_RULE =
  "Keep the room exactly as in the business photo: same walls, colors, furniture, equipment and light; do not change the layout. " +
  "Photorealistic, natural light, shot on a modern smartphone. No text, no logos, no watermark.";

function selfieInput(script: DemoScript, photoUrls: string[]) {
  return {
    prompt:
      `The attached photos show the real business location. ${ROOM_RULE} Add ${script.presenterLook}. ` +
      "Selfie video frame: the person holds the phone at arm's length (the phone is not visible), face and shoulders in frame, " +
      "camera slightly above eye level, friendly natural smile, mouth closed, the room clearly visible behind. Handheld UGC look, vertical 9:16.",
    image_input: photoUrls.slice(0, 3),
    aspect_ratio: "9:16",
    resolution: "1K",
    output_format: "jpg",
  };
}

const ANGLE_DESC: Record<"medium" | "close", string> = {
  medium:
    "Medium shot from the waist up: the person stands in the room facing the camera at eye level, mouth closed, relaxed hands, camera on a tripod, the room's main equipment visible.",
  close:
    "Close-up from the chest up at a three-quarter angle: the person looks into the camera with a warm expression, mouth closed, the room softly blurred behind.",
};

function angleInput(kind: "medium" | "close" | "action", script: DemoScript, selfieUrl: string, photoUrls: string[]) {
  const desc = kind === "action" ? `Candid moment, the person does not look at the camera: ${script.actionPrompt}.` : ANGLE_DESC[kind];
  return {
    prompt:
      "Image 1 shows the presenter; the other images show the real business location. " +
      "Use the SAME person as in image 1: identical face, hair, skin tone, body and clothing. " +
      `${ROOM_RULE} ${desc} Vertical 9:16.`,
    image_input: [selfieUrl, ...photoUrls.slice(0, 2)],
    aspect_ratio: "9:16",
    resolution: "1K",
    output_format: "jpg",
  };
}

function imageInput(prompt: string, photoUrl: string) {
  return {
    prompt: `The attached photo shows the real business location. ${ROOM_RULE} ${prompt} Professional advertising photo, 4:5 vertical.`,
    image_input: [photoUrl],
    aspect_ratio: "4:5",
    resolution: "1K",
    output_format: "jpg",
  };
}

function brollInput(prompt: string, imageUrl: string, withPerson: boolean) {
  return {
    prompt: withPerson
      ? `${prompt} Subtle natural movement, the same person, the room stays exactly the same, realistic, no text.`
      : `${prompt} Smooth cinematic camera move, the room stays exactly the same, realistic, no people appear, no text.`,
    image_urls: [imageUrl],
    duration: "3",
    resolution: "720p",
  };
}

function avatarInput(script: DemoScript, angle: Angle, imageUrl: string, audioUrl: string) {
  const cam = angle === "selfie" ? "Handheld selfie video with slight natural camera shake; the person talks to the phone camera." : "Static camera.";
  return { image_url: imageUrl, audio_url: audioUrl, prompt: `${script.avatarPrompt} ${cam}` };
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
  // Îl găsim prin rezolvarea pachetului la rulare, nu prin calea din import (bundle-ul strică __dirname).
  await import("ffmpeg-static"); // ține pachetul în build
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

const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Grupuri de 1–3 cuvinte. Cuvântul rostit e galben și puțin mai mare; cuvintele-cheie
 * (valorile din reclamă) apar mari, roz când nu sunt rostite.
 */
export function buildAss(words: Word[], keywords: string[] = []): string {
  const keys = new Set(keywords.flatMap((k) => k.split(/\s+/)).map(bare).filter((k) => k.length > 2));
  const chunks: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    const chars = cur.reduce((n, x) => n + x.w.length, 0);
    if (cur.length >= 3 || chars >= 15 || /[.,!?;:]$/.test(w.w) || keys.has(bare(w.w))) {
      chunks.push(cur);
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur);

  const fmt = (x: Word, current: boolean) => {
    const key = keys.has(bare(x.w));
    const color = current ? "&H003DD9FF&" : key ? "&H00D25FFF&" : "&H00FFFFFF&";
    const size = key ? "\\fs86" : current ? "\\fscx112\\fscy112" : "";
    return `{\\c${color}${size}}${assEscape(x.w)}{\\c&H00FFFFFF&\\fs64\\fscx100\\fscy100}`;
  };
  const lines: string[] = [];
  for (const chunk of chunks) {
    chunk.forEach((w, i) => {
      const end = i < chunk.length - 1 ? chunk[i + 1].s : w.e + 0.08;
      const text = chunk.map((x, j) => fmt(x, j === i)).join(" ");
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

export async function synthesizeVoice(
  text: string,
  presenter: "female" | "male",
  speed = 1,
): Promise<{ mp3: Uint8Array; words: Word[]; duration: number }> {
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
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true, speed },
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

/** Vocea între 20 și 25 de secunde: dacă iese în afară, o refacem cu altă viteză. */
async function voiceInRange(text: string, presenter: "female" | "male") {
  let v = await synthesizeVoice(text, presenter);
  if (v.duration > 25.3) v = await synthesizeVoice(text, presenter, Math.min(1.15, v.duration / 24.3));
  else if (v.duration < 19.7) v = await synthesizeVoice(text, presenter, Math.max(0.88, v.duration / 20.6));
  return v;
}

// ───────────────────────────── scenariul ─────────────────────────────

const GOAL_CTA: Record<string, string> = {
  calls: "îndeamnă omul să sune",
  forms: "îndeamnă omul să lase numărul de telefon în formular",
  web: "îndeamnă omul să intre pe site",
  shop: "îndeamnă omul să comande online",
};

async function writeScript(niche: string, goal: string | null, photoUrls: string[], fix?: string): Promise<DemoScript> {
  const { generateText } = await import("ai");
  const { chatModel } = await import("@/lib/llm.server");
  const instructions = `Ești copywriter de reclame video scurte (Reels/TikTok) pentru afaceri locale din România.
Afacerea: ${niche}. Pozele atașate sunt din locul real al afacerii.

Clipul are 20–25 de secunde și e montat din cadre scurte: prezentatorul vorbește la cameră din mai multe unghiuri,
iar între ele apar cadre cu spațiul din poze. Vocea lui se aude pe tot clipul.

Reguli pentru „voiceover” (textul rostit, în română):
- ÎNTRE 50 ȘI 58 DE CUVINTE (≈22 de secunde), cu diacritice corecte (ă, â, î, ș, ț), fără emoji, fără hashtag-uri, numerele în litere;
- structura: 1) o întrebare scurtă (max. 9 cuvinte) care oprește scroll-ul, legată de problema clientului;
  2) o propoziție de empatie; 3) DOUĂ-TREI valori puternice, concrete, ale afacerii (ce câștigă clientul), deduse din poze și din domeniu;
  4) îndemnul final;
- vorbește la persoana întâi plural („la noi”), cald și natural, ca un om, nu ca o reclamă la radio;
- nu inventa nume de firmă, prețuri, reduceri, ani de experiență sau garanții; fără promisiuni medicale sau „cel mai bun”;
- ultima propoziție ${goal ? GOAL_CTA[goal] ?? "îndeamnă omul să ne contacteze" : "îndeamnă omul să ne contacteze"}.
${fix ? `\nATENȚIE: ${fix}\n` : ""}
- keywords: 3–5 cuvinte din voiceover (exact cum apar), care poartă valorile — apar mari în subtitrări.

Restul câmpurilor sunt în ENGLEZĂ (pentru modelele de imagine/video):
- presenter: "female" sau "male", ce se potrivește afacerii;
- presenterLook: descrierea prezentatorului (vârstă 25–40, ținută potrivită afacerii, ex. "a friendly Romanian woman in her early 30s with long brown hair, wearing teal medical scrubs");
- avatarPrompt: cum vorbește (expresii calde, gesturi mici cu mâinile);
- actionPrompt: ce face prezentatorul în spațiu fără să vorbească (ex. "sits relaxed in the dental chair, eyes closed, smiling");
- actionMotion: mișcarea subtilă din acel cadru (ex. "she slowly leans back and smiles, gentle push-in");
- brollPrompts: exact 2 mișcări de cameră prin spațiul din poze, fără oameni: [cadru larg cu mișcare lentă, apropiere pe cel mai interesant detaliu (numește obiectul)];
- imagePrompts: 2 idei de poze publicitare în acest spațiu (ex. specialistul lucrând, clientul mulțumit).

Răspunde DOAR cu JSON valid:
{"voiceover":"...","keywords":["..."],"presenter":"female","presenterLook":"...","avatarPrompt":"...","actionPrompt":"...","actionMotion":"...","brollPrompts":["...","..."],"imagePrompts":["...","..."]}`;

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
      "The person talks warmly to the camera with natural expressions and small hand gestures.",
    actionPrompt: String(j.actionPrompt ?? "").trim() || "works calmly in the space, focused and smiling",
    actionMotion: String(j.actionMotion ?? "").trim() || "gentle natural movement, slow push-in",
    brollPrompts: arr(j.brollPrompts, 2),
    imagePrompts: arr(j.imagePrompts, 2),
    keywords: arr(j.keywords, 5),
  };
  while (script.brollPrompts.length < 2) script.brollPrompts.push("Slow cinematic dolly-in through the room.");
  while (script.imagePrompts.length < 2) script.imagePrompts.push("A specialist working in this space, smiling.");
  return script;
}

const wordCount = (t: string) => t.split(/\s+/).filter(Boolean).length;

// ───────────────────────────── pașii ─────────────────────────────

/** Taie poza la 9:16 (720×1280) pentru cadrele din spațiu. */
async function cropVertical(bytes: Uint8Array, work: string, i: number): Promise<Uint8Array> {
  const bin = await ffmpeg();
  const inp = join(work, `p${i}`);
  const out = join(work, `c${i}.jpg`);
  await writeFile(inp, bytes);
  await run(bin, ["-y", "-i", inp, "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280", "-frames:v", "1", "-q:v", "3", out]);
  return new Uint8Array(await readFile(out));
}

/** Taie bucata de voce [t0, t1] pentru un cadru vorbit. */
async function cutAudio(voice: Uint8Array, t0: number, t1: number, work: string, i: number): Promise<Uint8Array> {
  const bin = await ffmpeg();
  const inp = join(work, "voice.mp3");
  await writeFile(inp, voice);
  const out = join(work, `seg${i}.mp3`);
  await run(bin, ["-y", "-i", inp, "-ss", t0.toFixed(3), "-to", t1.toFixed(3), "-c:a", "libmp3lame", "-q:a", "2", out]);
  return new Uint8Array(await readFile(out));
}

// ───────────────────────────── ce clip procesăm ─────────────────────────────

/** Clipul de la înscriere (onboarding_sessions, cheie user_id) sau un clip nou (ai_clip_jobs, cheie id). */
export type JobRef = { table: "onboarding_sessions" | "ai_clip_jobs"; key: "user_id" | "id"; id: string };
const ONB = (userId: string): JobRef => ({ table: "onboarding_sessions", key: "user_id", id: userId });
const CLIP = (jobId: string): JobRef => ({ table: "ai_clip_jobs", key: "id", id: jobId });
const isOnb = (ref: JobRef) => ref.table === "onboarding_sessions";
const upd = (db: any, ref: JobRef, patch: Record<string, unknown>) => db.from(ref.table).update(patch).eq(ref.key, ref.id);
/** Unde salvăm fișierele: demo-ul în <user>/demo, clipurile noi fiecare în folderul lor. */
const prefixOf = (ref: JobRef, uid: string) => (isOnb(ref) ? `${uid}/demo` : `${uid}/clips/${ref.id}`);
/** Pozele de pornire: la onboarding sunt în bucket-ul nostru; la clipurile noi pot fi și în wa-media. */
function photoRefsOf(s: any): Array<{ bucket: string; path: string }> {
  if (Array.isArray(s.photo_refs) && s.photo_refs.length) return s.photo_refs;
  return (s.photo_paths ?? []).map((p: string) => ({ bucket: BUCKET, path: p }));
}
async function signedFrom(db: any, bucket: string, path: string, seconds = 60 * 60 * 24): Promise<string> {
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, seconds);
  if (error || !data?.signedUrl) throw new Error(`signed url ${bucket}/${path}: ${error?.message}`);
  return data.signedUrl;
}

async function stepScript(db: any, s: any, job: Job, ref: JobRef): Promise<void> {
  const uid = s.user_id as string;
  const pre = prefixOf(ref, uid);
  const photoUrls = await Promise.all(photoRefsOf(s).slice(0, 3).map((r) => signedFrom(db, r.bucket, r.path)));
  if (!photoUrls.length) throw new Error("fără poze");
  job.photoUrls = photoUrls;
  const niche = [s.niche ?? "afacere locală", s.brief ? `(ce vrea clientul în acest clip: ${s.brief})` : ""].filter(Boolean).join(" ");

  if (!job.script) {
    let script = await writeScript(niche, s.goal, photoUrls);
    const n = wordCount(script.voiceover);
    if (n < 46 || n > 64) {
      script = await writeScript(
        niche,
        s.goal,
        photoUrls,
        `textul anterior avea ${n} cuvinte; scrie între 50 și 58 de cuvinte.`,
      );
    }
    if (wordCount(script.voiceover) < 30) throw new Error("script: voiceover too short");
    job.script = script;
  }
  const script = job.script;

  const work = await mkdtemp(join(tmpdir(), "demo-"));
  try {
    const crops: string[] = [];
    const cropPaths: string[] = [];
    for (let i = 0; i < Math.min(2, photoUrls.length); i++) {
      const c = await cropVertical(await download(photoUrls[i]), work, i);
      const path = `${pre}/crop_${i}.jpg`;
      await upload(db, path, c, "image/jpeg");
      cropPaths.push(path);
      crops.push(await signedUrl(db, path));
    }
    job.crops = crops;
    job.cropPaths = cropPaths;

    const voice = await voiceInRange(script.voiceover, script.presenter);
    const voicePath = `${pre}/voice.mp3`;
    await upload(db, voicePath, voice.mp3, "audio/mpeg");
    job.voice = { path: voicePath, duration: voice.duration, words: voice.words };

    const plan = planShots(voice.words, voice.duration);
    for (const [i, shot] of plan.entries()) {
      if (shot.kind !== "talk") continue;
      const seg = await cutAudio(voice.mp3, shot.t0, shot.t1, work, i);
      shot.audio = `${pre}/seg_${i}.mp3`;
      await upload(db, shot.audio, seg, "audio/mpeg");
    }
    job.plan = plan;
  } finally {
    await rm(work, { recursive: true, force: true });
  }

  const crops = job.crops!;
  job.frames = { selfie: await kieCreate("nano-banana-pro", selfieInput(script, photoUrls)) };
  job.images = await Promise.all(
    script.imagePrompts.map((p, i) => kieCreate("nano-banana-pro", imageInput(p, photoUrls[i % photoUrls.length]))),
  );
  job.broll = {
    wide: await kieCreate("kling/v3-turbo-image-to-video", brollInput(script.brollPrompts[0], crops[0], false)),
    detail: await kieCreate("kling/v3-turbo-image-to-video", brollInput(script.brollPrompts[1], crops[1 % crops.length], false)),
  };
  job.avatars = {};
  job.phase = "clips";
}

/**
 * Repornește o dată un task eșuat; a doua oară întoarce null.
 * O pană la kie nu consumă reîncercarea: sarcina așteaptă și e refăcută mai târziu (kieRetryTransient).
 */
async function retryOnce(t: Task, make: () => Promise<Task>): Promise<Task | null> {
  if (kieWaitingRetry(t)) return (await kieRetryTransient(t)) ?? t;
  if ((t.retries ?? 0) >= 1) return null;
  return { ...(await make()), retries: 1 };
}

/**
 * La „Refă clipul”: păstrăm ce a ieșit deja (scenariul, vocea, cadrele și clipurile reușite) și refacem
 * doar sarcinile picate — fără să plătim din nou pentru pașii buni. Doar dacă încercarea e recentă
 * (linkurile semnate și fișierele temporare kie expiră). Altfel, null = de la zero.
 */
export function reusableDemoJob(job: any, updatedAt?: string | null): Record<string, unknown> | null {
  if (!job?.script || !job?.voice || !Array.isArray(job?.plan)) return null;
  if (!updatedAt || Date.now() - new Date(updatedAt).getTime() > 20 * 3600_000) return null;
  // Sarcinile care știu cum au fost create se refac imediat, cu aceleași date. Celelalte:
  //  - cadrele: rămân „picate” cu reîncercarea resetată → retryOnce le recreează;
  //  - avatarurile: se șterg → bucla le recreează din cadru;
  //  - b-roll / poze: rămân picate → montajul folosește poza clientului cu zoom.
  const again = (t: KieTask | undefined, otherwise: "reset" | "drop" | "keep"): KieTask | undefined => {
    if (!t || t.url || !t.failed) return t;
    if (t.model && t.input) return { ...t, transient: true, transientRetries: 0, retryAt: 0 };
    return otherwise === "drop" ? undefined : otherwise === "reset" ? { ...t, retries: 0 } : t;
  };
  const map = (o: Record<string, KieTask> | undefined, otherwise: "reset" | "drop" | "keep") =>
    Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, again(v, otherwise)]).filter(([, v]) => v));
  return {
    ...job,
    phase: "clips",
    errors: 0,
    lastError: undefined,
    frames: map(job.frames, "reset"),
    avatars: map(job.avatars, "drop"),
    broll: map(job.broll, "keep"),
    images: (job.images ?? []).map((t: KieTask) => again(t, "keep") ?? t),
  };
}

/** Poll + reluarea după o pană kie, pentru sarcinile fără reîncercare proprie (b-roll, poze). */
async function pollOrRetry(t?: Task): Promise<Task | undefined> {
  return kieRetryTransient(await kiePoll(t));
}

async function stepClips(db: any, s: any, job: Job): Promise<void> {
  const script = job.script!;
  const photoUrls = job.photoUrls!;
  const frames = (job.frames ??= {});
  const avatars = (job.avatars ??= {});
  const broll = (job.broll ??= {});

  // 1) Selfie-ul: fără el nu avem prezentator.
  frames.selfie = await kiePoll(frames.selfie);
  if (frames.selfie?.failed) {
    const r = await retryOnce(frames.selfie, () => kieCreate("nano-banana-pro", selfieInput(script, photoUrls)));
    if (!r) throw new Error("selfie frame failed");
    frames.selfie = r;
  }
  const selfie = frames.selfie?.url ?? null;

  // 2) Celelalte unghiuri pornesc din selfie (aceeași persoană). Dacă eșuează de două ori, folosim selfie-ul.
  if (selfie) {
    for (const k of ["medium", "close", "action"] as const) {
      if (!frames[k]) frames[k] = await kieCreate("nano-banana-pro", angleInput(k, script, selfie, photoUrls));
      frames[k] = await kiePoll(frames[k]);
      if (frames[k]?.failed && !frames[k]?.fallback) {
        const r = await retryOnce(frames[k]!, () => kieCreate("nano-banana-pro", angleInput(k, script, selfie, photoUrls)));
        frames[k] = r ?? { ...frames[k]!, failed: false, url: k === "action" ? null : selfie, fallback: true };
      }
    }
  }

  // 3) Câte un avatar pe fiecare cadru vorbit, cu bucata lui de voce.
  for (const [i, shot] of (job.plan ?? []).entries()) {
    if (shot.kind !== "talk") continue;
    const frame = frames[shot.angle]?.url;
    const key = String(i);
    if (frame && !avatars[key]) {
      avatars[key] = await kieCreate("kling/ai-avatar-standard", avatarInput(script, shot.angle, frame, await signedUrl(db, shot.audio!)));
    }
    avatars[key] = (await kiePoll(avatars[key]))!;
    if (avatars[key]?.failed) {
      const r = await retryOnce(avatars[key], async () =>
        kieCreate("kling/ai-avatar-standard", avatarInput(script, shot.angle, frame!, await signedUrl(db, shot.audio!))),
      );
      if (!r) throw new Error(`avatar ${i} failed`);
      avatars[key] = r;
    }
    if (!avatars[key]) delete avatars[key];
  }

  // 4) Cadrele fără vorbă: ipostaza în acțiune (din cadrul ei) și cele două din poza clientului.
  if (frames.action?.url && !broll.action) {
    broll.action = await kieCreate("kling/v3-turbo-image-to-video", brollInput(script.actionMotion, frames.action.url, true));
  }
  for (const k of ["wide", "detail", "action"] as const) broll[k] = await pollOrRetry(broll[k]);
  job.images = (await Promise.all((job.images ?? []).map((t) => pollOrRetry(t)))) as Task[];

  // Gata = are rezultat sau a picat definitiv (nu „așteaptă reluarea după o pană kie”).
  const settled = (t?: Task) => !!t && (!!t.url || (!!t.failed && !kieWaitingRetry(t)));
  const talks = (job.plan ?? []).filter((x) => x.kind === "talk").length;
  const avatarsDone = Object.values(avatars).filter((a) => a.url).length === talks;
  const actionDone = settled(broll.action) || !!frames.action?.fallback || (!!frames.action?.failed && !kieWaitingRetry(frames.action));
  if (avatarsDone && settled(broll.wide) && settled(broll.detail) && actionDone && (job.images ?? []).every(settled)) {
    job.phase = "render";
  }
}

/** Un cadru din montaj: clip video, sau o poză cu zoom lent dacă clipul lipsește. */
type RenderShot = { file: string; image: boolean; dur: number };

/**
 * Montajul: cadrele lipite pe tăieturi (video fără sunet), vocea întreagă dedesubt,
 * subtitrări cuvânt cu cuvânt. Întoarce calea fișierului mp4 din `work`.
 */
export async function renderDemoVideo(params: {
  work: string;
  shots: RenderShot[];
  voiceFile: string;
  words: Word[];
  keywords?: string[];
  duration: number;
}): Promise<string> {
  const { work, shots } = params;
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
  await writeFile(assFile, buildAss(params.words, params.keywords));

  const norm = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1";
  const inputs: string[] = [];
  const filters: string[] = [];
  shots.forEach((sh, i) => {
    const d = sh.dur.toFixed(3);
    if (sh.image) {
      inputs.push("-loop", "1", "-framerate", "30", "-t", (sh.dur + 0.5).toFixed(2), "-i", sh.file);
      filters.push(
        `[${i}:v]${norm},zoompan=z='min(zoom+0.0015,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=720x1280:fps=30,trim=0:${d},setpts=PTS-STARTPTS[s${i}]`,
      );
    } else {
      inputs.push("-i", sh.file);
      filters.push(`[${i}:v]${norm},fps=30,tpad=stop_mode=clone:stop_duration=3,trim=0:${d},setpts=PTS-STARTPTS[s${i}]`);
    }
  });
  filters.push(`${shots.map((_, i) => `[s${i}]`).join("")}concat=n=${shots.length}:v=1:a=0[vc]`);
  filters.push(`[vc]ass=${assFile}:fontsdir=${fontDir}[vout]`);

  const out = join(work, "clip.mp4");
  await run(
    bin,
    [
      "-y",
      ...inputs,
      "-i",
      params.voiceFile,
      "-filter_complex",
      filters.join(";"),
      "-map",
      "[vout]",
      "-map",
      `${shots.length}:a`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "21",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-movflags",
      "+faststart",
      "-t",
      (params.duration + 0.3).toFixed(2),
      out,
    ],
    { FONTCONFIG_FILE: fcConf },
  );
  return out;
}

async function stepRender(db: any, s: any, job: Job, ref: JobRef): Promise<void> {
  const uid = s.user_id as string;
  const pre = prefixOf(ref, uid);
  const work = await mkdtemp(join(tmpdir(), "render-"));
  try {
    const voiceFile = join(work, "voice.mp3");
    await writeFile(voiceFile, await download(await signedUrl(db, job.voice!.path)));

    const fallbackImage = async (name: string, path: string | undefined, url?: string | null) => {
      const f = join(work, `${name}.jpg`);
      await writeFile(f, await download(url ?? (await signedUrl(db, path!))));
      return f;
    };

    const shots: RenderShot[] = [];
    for (const [i, shot] of job.plan!.entries()) {
      const dur = Math.max(0.4, shot.t1 - shot.t0);
      if (shot.kind === "talk") {
        const f = join(work, `t${i}.mp4`);
        await writeFile(f, await download(job.avatars![String(i)].url!));
        shots.push({ file: f, image: false, dur });
        continue;
      }
      const clip = job.broll?.[shot.src]?.url;
      if (clip) {
        const f = join(work, `b${i}.mp4`);
        await writeFile(f, await download(clip));
        shots.push({ file: f, image: false, dur });
      } else {
        // Fără clip: poza (sau cadrul cu prezentatorul) cu zoom lent.
        const crops = job.cropPaths ?? [];
        const img =
          shot.src === "action" && job.frames?.action?.url
            ? await fallbackImage(`a${i}`, undefined, job.frames.action.url)
            : await fallbackImage(`c${i}`, crops[shot.src === "detail" ? 1 % crops.length : 0]);
        shots.push({ file: img, image: true, dur });
      }
    }

    const out = await renderDemoVideo({
      work,
      shots,
      voiceFile,
      words: job.voice!.words,
      keywords: job.script?.keywords,
      duration: job.voice!.duration,
    });
    const videoPath = `${pre}/clip.mp4`;
    await upload(db, videoPath, new Uint8Array(await readFile(out)), "video/mp4");

    const imagePaths: string[] = [];
    for (const [i, t] of (job.images ?? []).entries()) {
      if (!t.url) continue;
      const p = `${pre}/image_${i}.jpg`;
      await upload(db, p, await download(t.url), "image/jpeg");
      imagePaths.push(p);
    }

    const now = new Date().toISOString();
    await upd(db, ref, { demo_video_path: videoPath, demo_image_paths: imagePaths, demo_status: "ready", demo_ready_at: now });
    // Istoricul din pagina „Materiale”.
    const source = isOnb(ref) ? "onboarding" : (s.source ?? "whatsapp");
    const jobId = isOnb(ref) ? null : ref.id;
    await db.from("ai_assets").insert([
      { user_id: uid, kind: "video", bucket: BUCKET, path: videoPath, source, job_id: jobId },
      ...imagePaths.map((p) => ({ user_id: uid, kind: "image", bucket: BUCKET, path: p, source, job_id: jobId })),
    ]);
    s.demo_status = "ready";
    job.phase = "deliver";
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function stepDeliver(db: any, s: any, job: Job, ref: JobRef): Promise<void> {
  const { getCentralWhatsApp, sendWhatsAppTemplate } = await import("./whatsapp.server");
  const central = getCentralWhatsApp();
  if (!central) throw new Error("WhatsApp central lipsește");
  const { data: wa } = await db
    .from("whatsapp_connections")
    .select("id, user_phone")
    .eq("user_id", s.user_id)
    .eq("status", "active")
    .maybeSingle();
  const phone = String(wa?.user_phone ?? "").replace(/\D/g, "");
  if (!phone) throw new Error("fără număr WhatsApp");

  // Clip nou cerut din conversație: dacă fereastra de 24h e încă deschisă, îl trimitem direct.
  if (!isOnb(ref)) {
    const { isWindowOpen } = await import("./wa-notify.server");
    if (await isWindowOpen(db, s.user_id)) {
      await deliverMaterials(db, ref, { userId: s.user_id, connectionId: wa!.id, toPhone: phone });
      job.phase = "done";
      return;
    }
  }
  await sendWhatsAppTemplate(
    central.phoneNumberId,
    central.accessToken,
    phone,
    DELIVERY_TEMPLATE,
    "ro",
    [String(s.niche ?? "afacerea ta").toLowerCase()],
    undefined,
    [{ subType: "quick_reply", index: 0, param: { type: "payload", payload: isOnb(ref) ? DELIVERY_PAYLOAD : `${DELIVERY_PAYLOAD}:${ref.id}` } }],
  );
  await upd(db, ref, { template_sent_at: new Date().toISOString() });
  job.phase = "done";
}

/**
 * Avansează un clip cât se poate acum. Sigur la apeluri simultane (lock în DB).
 */
async function advanceJob(db: any, ref: JobRef): Promise<void> {
  const nowIso = new Date().toISOString();
  const { data: locked } = await db
    .from(ref.table)
    .update({ demo_lock_until: new Date(Date.now() + LOCK_MS).toISOString() })
    .eq(ref.key, ref.id)
    .in("demo_status", ["queued", "running", "ready"])
    .or(`demo_lock_until.is.null,demo_lock_until.lt.${nowIso}`)
    .select("*");
  const s = locked?.[0];
  if (!s) return;
  if (s.demo_status === "ready" && s.template_sent_at) {
    await upd(db, ref, { demo_lock_until: null });
    return;
  }

  const job: Job = { ...(s.demo_job ?? {}) };
  if (!job.phase) job.phase = "script";
  let failed = false;
  try {
    if (s.demo_status === "queued") {
      await upd(db, ref, { demo_status: "running" });
      s.demo_status = "running";
    }
    if (job.phase === "script") await stepScript(db, s, job, ref);
    if (job.phase === "clips") await stepClips(db, s, job);
    if (job.phase === "render") await stepRender(db, s, job, ref);
    if (job.phase === "deliver") await stepDeliver(db, s, job, ref);
  } catch (e) {
    job.errors = (job.errors ?? 0) + 1;
    job.lastError = (e as Error).message.slice(0, 500);
    console.error("[clip]", ref.table, ref.id, job.phase, job.lastError);
    failed = job.errors >= MAX_ERRORS && job.phase !== "deliver";
  } finally {
    await upd(db, ref, {
      demo_job: job,
      demo_lock_until: null,
      ...(failed ? { demo_status: "failed", demo_error: job.lastError } : {}),
      updated_at: new Date().toISOString(),
    });
  }
}

/** Clipul gratuit de la înscriere. */
export async function advanceDemo(db: any, userId: string): Promise<void> {
  return advanceJob(db, ONB(userId));
}

/** Un clip nou (cerut pe WhatsApp sau din aplicație). */
export async function advanceClipJob(db: any, jobId: string): Promise<void> {
  return advanceJob(db, CLIP(jobId));
}

/** Cron: avansează toate clipurile în lucru (și trimite șablonul celor gata). */
export async function tickDemos(): Promise<{ processed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const pending = (r: any) => r.demo_status !== "ready" || !r.template_sent_at;
  const [{ data: onb }, { data: jobs }] = await Promise.all([
    db
      .from("onboarding_sessions")
      .select("user_id, demo_status, template_sent_at")
      .in("demo_status", ["queued", "running", "ready"])
      .order("demo_started_at", { ascending: true })
      .limit(10),
    db
      .from("ai_clip_jobs")
      .select("id, demo_status, template_sent_at")
      .in("demo_status", ["queued", "running", "ready"])
      .order("demo_started_at", { ascending: true })
      .limit(10),
  ]);
  const a = (onb ?? []).filter(pending);
  const b = (jobs ?? []).filter(pending);
  for (const r of a) await advanceDemo(db, r.user_id);
  for (const r of b) await advanceClipJob(db, r.id);
  return { processed: a.length + b.length };
}

/** Creează un clip nou (după verificarea limitei lunare, făcută de cel care cheamă). */
export async function createClipJob(
  db: any,
  params: { userId: string; source: "whatsapp" | "web"; brief?: string | null; photoRefs: Array<{ bucket: string; path: string }> },
): Promise<string> {
  const { data: onb } = await db.from("onboarding_sessions").select("niche, goal").eq("user_id", params.userId).maybeSingle();
  const { data, error } = await db
    .from("ai_clip_jobs")
    .insert({
      user_id: params.userId,
      source: params.source,
      niche: onb?.niche ?? null,
      goal: onb?.goal ?? null,
      brief: (params.brief ?? "").trim().slice(0, 300) || null,
      photo_refs: params.photoRefs.slice(0, 3),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Nu am putut porni clipul.");
  return data.id as string;
}

/** Ultimele poze reale trimise pe WhatsApp (nu cele generate), apoi cele de la înscriere. */
export async function latestClientPhotos(db: any, userId: string): Promise<Array<{ bucket: string; path: string }>> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: rows } = await db
    .from("whatsapp_messages")
    .select("media_path")
    .eq("user_id", userId)
    .eq("direction", "in")
    .like("media_mime", "image/%")
    .not("media_path", "is", null)
    .not("wa_message_id", "like", "ai-gen-%")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(3);
  const wa = (rows ?? []).map((r: any) => ({ bucket: "wa-media", path: r.media_path as string }));
  if (wa.length) return wa;
  const { data: s } = await db.from("onboarding_sessions").select("photo_paths").eq("user_id", userId).maybeSingle();
  return (s?.photo_paths ?? []).slice(0, 3).map((p: string) => ({ bucket: BUCKET, path: p }));
}

// ───────────────────────────── livrarea pe WhatsApp ─────────────────────────────

const TARGET_NAMES: Record<string, string> = { fb: "Facebook și Instagram", tt: "TikTok" };

/**
 * Omul a apăsat „Trimite-mi materialele” (fereastra de 24h e deschisă): clipul,
 * pozele și întrebarea cu butoane. Întoarce false dacă nu are materiale gata.
 */
export async function deliverDemoMaterials(
  db: any,
  params: { userId: string; connectionId: string; toPhone: string; payload?: string | null },
): Promise<boolean> {
  // Buton dintr-un șablon pentru un clip nou: „materiale:<id>”.
  const jobId = params.payload?.startsWith(`${DELIVERY_PAYLOAD}:`) ? params.payload.slice(DELIVERY_PAYLOAD.length + 1) : null;
  if (jobId) return deliverMaterials(db, CLIP(jobId), params);
  if (await deliverMaterials(db, ONB(params.userId), params)) return true;
  // Fără payload: cel mai recent clip nou gata și nelivrat.
  const { data: j } = await db
    .from("ai_clip_jobs")
    .select("id")
    .eq("user_id", params.userId)
    .eq("demo_status", "ready")
    .order("demo_ready_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return j ? deliverMaterials(db, CLIP(j.id), params) : false;
}

async function deliverMaterials(
  db: any,
  ref: JobRef,
  params: { userId: string; connectionId: string; toPhone: string },
): Promise<boolean> {
  const { data: s } = await db.from(ref.table).select("*").eq(ref.key, ref.id).maybeSingle();
  if (!s || s.user_id !== params.userId) return false;
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
    caption: isOnb(ref) ? "🎬 Clipul tău" : "🎬 Clipul tău nou",
  });
  await log(v.id, "video", isOnb(ref) ? "Clipul tău (demo)" : "Clip nou");
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
  const q = isOnb(ref) ? `Vrei să pornesc și o reclamă cu ele? ${conn}` : "Vrei să pornesc o reclamă cu clipul ăsta?";
  const b = await sendWhatsAppMessage(central.phoneNumberId, central.accessToken, params.toPhone, {
    type: "buttons",
    text: q,
    buttons: [
      { id: "demo_ad_yes", title: "Da, pornim" },
      { id: "demo_ad_no", title: "Nu acum" },
    ],
  });
  await log(b.id, "interactive", q);
  await upd(db, ref, { demo_status: "delivered", delivered_at: new Date().toISOString() });
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
      "- I-am trimis deja pe WhatsApp clipul demo și pozele generate. Dacă răspunde „Da, pornim”: ÎNTÂI întreabă pe ce platformă pornim, Facebook (cu Instagram) sau TikTok, și lasă-l să scrie el răspunsul. Apoi, pe rând: orașul/zona, vârsta clientului ideal și ce folosim în reclamă (clipul din chat, pozele din chat sau altceva). Clipul din chat e media disponibilă pentru campanie.",
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
  const [{ data: onb }, { data: job }] = await Promise.all([
    db.from("onboarding_sessions").select("demo_status, delivered_at, demo_image_paths").eq("user_id", userId).maybeSingle(),
    db
      .from("ai_clip_jobs")
      .select("demo_status, delivered_at, demo_image_paths")
      .eq("user_id", userId)
      .eq("demo_status", "delivered")
      .order("delivered_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const cands = [onb, job].filter((x: any) => x?.demo_status === "delivered" && x.delivered_at);
  cands.sort((x: any, y: any) => String(y.delivered_at).localeCompare(String(x.delivered_at)));
  const s: any = cands[0];
  if (!s) return null;
  if (Date.now() - new Date(s.delivered_at).getTime() > 7 * 86400_000) return null;
  const image = preferImage && (s.demo_image_paths ?? []).length > 0;
  const path = demoWaPath(userId, image ? "image_0.jpg" : "clip.mp4");
  const { data } = await db.storage.from("wa-media").createSignedUrl(path, 60 * 60 * 24 * 7);
  if (!data?.signedUrl) return null;
  return { path, mime: image ? "image/jpeg" : "video/mp4", signedUrl: data.signedUrl };
}
