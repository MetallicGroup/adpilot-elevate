/**
 * kie.ai (server-only): o singură poartă către modelele de imagine și video
 * (Nano Banana Pro, Kling AI Avatar, Kling 3.0 Turbo). Task-urile sunt asincrone:
 * `kieCreate` pornește, `kiePoll` verifică o dată, `kieWait` așteaptă rezultatul.
 */
const KIE = "https://api.kie.ai/api/v1/jobs";
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;

export type KieTask = {
  id: string;
  url?: string | null;
  failed?: boolean;
  startedAt: number;
  retries?: number;
  fallback?: boolean;
  /** Modelul și datele cu care a fost creat (ca să-l putem reface identic după o pană kie). */
  model?: string;
  input?: Record<string, unknown>;
  /** Motivul dat de kie la eșec. */
  failMsg?: string;
  /** Pană la kie („internal error, try again later”): nu e vina cererii, se reface mai târziu. */
  transient?: boolean;
  transientRetries?: number;
  retryAt?: number;
};

/** De câte ori refacem o sarcină picată din cauza unei pane kie (la 3, 6, 9, 12 minute). */
export const KIE_TRANSIENT_MAX = 4;
const KIE_TRANSIENT_STEP_MS = 3 * 60 * 1000;

function isTransientFail(msg?: string | null): boolean {
  return /internal error|try again|server error|busy|overload|timed? ?out|rate limit|unavailable|503|502/i.test(msg ?? "");
}

/** Sarcina așteaptă o reluare după o pană kie (încă nu e un eșec definitiv). */
export function kieWaitingRetry(t?: KieTask): boolean {
  return !!t?.failed && !!t.transient && (t.transientRetries ?? 0) < KIE_TRANSIENT_MAX;
}

/**
 * După o pană kie: la momentul potrivit refacem sarcina cu aceleași date (fără să ne coste
 * pașii reușiți de dinainte). Până atunci întoarce sarcina neschimbată, cu `retryAt` setat.
 */
export async function kieRetryTransient(t?: KieTask): Promise<KieTask | undefined> {
  if (!t || !kieWaitingRetry(t) || !t.model || !t.input) return t;
  const n = t.transientRetries ?? 0;
  const at = t.retryAt ?? Date.now() + KIE_TRANSIENT_STEP_MS * (n + 1);
  if (Date.now() < at) return { ...t, retryAt: at };
  try {
    const fresh = await kieCreate(t.model, t.input);
    return { ...fresh, retries: t.retries, fallback: t.fallback, transientRetries: n + 1 };
  } catch (e) {
    // kie încă nu primește cereri: mai așteptăm un pas.
    console.warn("[kie] retry create failed", t.model, (e as Error).message);
    return { ...t, retryAt: Date.now() + KIE_TRANSIENT_STEP_MS, transientRetries: n + 1 };
  }
}

function kieKey(): string {
  const k = process.env.KIE_API_KEY;
  if (!k) throw new Error("KIE_API_KEY lipsește");
  return k;
}

export async function kieCreate(model: string, input: Record<string, unknown>): Promise<KieTask> {
  const res = await fetch(`${KIE}/createTask`, {
    method: "POST",
    headers: { Authorization: `Bearer ${kieKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input }),
  });
  const json: any = await res.json().catch(() => null);
  const id = json?.data?.taskId;
  if (json?.code !== 200 || !id) throw new Error(`kie ${model}: ${json?.msg ?? res.status}`);
  return { id, startedAt: Date.now(), model, input };
}

/** Actualizează un task: url la succes, failed la eșec sau timeout. */
export async function kiePoll(t: KieTask | undefined, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<KieTask | undefined> {
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
    console.error("[kie] task failed", t.id, d.failMsg);
    return { ...t, failed: true, failMsg: String(d.failMsg ?? "").slice(0, 200), transient: isTransientFail(d.failMsg) };
  }
  if (Date.now() - t.startedAt > timeoutMs) return { ...t, failed: true };
  return t;
}

/** Așteaptă un task (ex. o poză, ~30–60 s) până la `timeoutMs`. Aruncă dacă eșuează. */
export async function kieWait(t: KieTask, timeoutMs = 150_000, everyMs = 3000): Promise<string> {
  let cur: KieTask | undefined = t;
  while (cur && !cur.url && !cur.failed) {
    await new Promise((r) => setTimeout(r, everyMs));
    cur = await kiePoll(cur, timeoutMs);
  }
  if (!cur?.url) throw new Error("Generarea nu a reușit. Încearcă din nou.");
  return cur.url;
}
