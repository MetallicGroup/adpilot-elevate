/**
 * kie.ai (server-only): o singură poartă către modelele de imagine și video
 * (Nano Banana Pro, Kling AI Avatar, Kling 3.0 Turbo). Task-urile sunt asincrone:
 * `kieCreate` pornește, `kiePoll` verifică o dată, `kieWait` așteaptă rezultatul.
 */
const KIE = "https://api.kie.ai/api/v1/jobs";
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;

export type KieTask = { id: string; url?: string | null; failed?: boolean; startedAt: number; retries?: number; fallback?: boolean };

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
  return { id, startedAt: Date.now() };
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
    return { ...t, failed: true };
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
