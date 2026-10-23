/**
 * Pagina „Materiale”: istoricul clipurilor și pozelor generate cu AI, plus clip nou / poză nouă
 * din aplicație, cu aceleași limite lunare ca pe WhatsApp.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MaterialItem = {
  id: string;
  kind: "image" | "video";
  url: string | null;
  /** onboarding | whatsapp | web */
  source: string;
  prompt: string | null;
  created_at: string;
};

export type ClipInProgress = {
  id: string;
  status: string;
  progress: number;
  step: string | null;
  failed: boolean;
  created_at: string;
};

export type MaterialsState = {
  items: MaterialItem[];
  jobs: ClipInProgress[];
  quota: {
    clips: { allowed: boolean; used: number; limit: number; message: string | null };
    photos: { allowed: boolean; used: number; limit: number | null; message: string | null };
  };
};

export const listMaterials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MaterialsState> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { advanceClipJob, demoProgress } = await import("@/lib/demo-video.server");

    // Cât timp pagina e deschisă, fiecare citire avansează și clipurile în lucru.
    const { data: active } = await db
      .from("ai_clip_jobs")
      .select("id, demo_status, template_sent_at")
      .eq("user_id", userId)
      .in("demo_status", ["queued", "running", "ready"])
      .limit(3);
    for (const j of active ?? []) {
      if (j.demo_status === "ready" && j.template_sent_at) continue;
      try {
        await advanceClipJob(db, j.id);
      } catch (e) {
        console.error("[materials] advance", j.id, (e as Error).message);
      }
    }

    const since = new Date(Date.now() - 2 * 86400_000).toISOString();
    const [{ data: assets }, { data: jobs }] = await Promise.all([
      db
        .from("ai_assets")
        .select("id, kind, bucket, path, source, prompt, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(120),
      db
        .from("ai_clip_jobs")
        .select("id, demo_status, demo_job, created_at")
        .eq("user_id", userId)
        .in("demo_status", ["queued", "running", "failed"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const urls = new Map<string, string>();
    const byBucket = new Map<string, string[]>();
    for (const a of assets ?? []) byBucket.set(a.bucket, [...(byBucket.get(a.bucket) ?? []), a.path]);
    for (const [bucket, paths] of byBucket) {
      const { data } = await db.storage.from(bucket).createSignedUrls(paths, 60 * 60);
      for (const d of data ?? []) if (d.signedUrl) urls.set(`${bucket}/${d.path}`, d.signedUrl);
    }

    const { checkAiClipQuota, clipQuotaMessage, checkAiPhotoQuota } = await import("@/lib/plan.server");
    const [cq, pq] = await Promise.all([checkAiClipQuota(db, userId), checkAiPhotoQuota(db, userId)]);

    return {
      items: (assets ?? []).map((a: any) => ({
        id: a.id,
        kind: a.kind,
        url: urls.get(`${a.bucket}/${a.path}`) ?? null,
        source: a.source,
        prompt: a.prompt ?? null,
        created_at: a.created_at,
      })),
      jobs: (jobs ?? []).map((j: any) => {
        const p = demoProgress(j.demo_status, j.demo_job ?? {});
        return { id: j.id, status: j.demo_status, progress: p.progress, step: p.step, failed: j.demo_status === "failed", created_at: j.created_at };
      }),
      quota: {
        clips: { allowed: cq.allowed, used: cq.used, limit: cq.limit, message: cq.allowed ? null : clipQuotaMessage(cq) },
        photos: {
          allowed: pq.allowed,
          used: pq.used,
          limit: Number.isFinite(pq.limit) ? pq.limit : null,
          message: pq.allowed
            ? null
            : pq.limit === 0
              ? "Pozele noi cu AI se deblochează după plata abonamentului: 10 pe lună pe Pro, nelimitat pe Premium."
              : `Ai folosit cele ${pq.limit} poze AI din luna asta.`,
        },
      },
    };
  });

function ownPaths(userId: string, raw: unknown): string[] {
  const paths = Array.isArray(raw) ? raw.filter((p): p is string => typeof p === "string") : [];
  if (paths.some((p) => !p.startsWith(`${userId}/`) || p.includes(".."))) throw new Error("Poze invalide.");
  return paths.slice(0, 3);
}

/** Clip nou din aplicație: din pozele încărcate acum sau, dacă nu sunt, din ultimele poze ale clientului. */
export const createClipFromWeb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const d = (raw ?? {}) as { paths?: unknown; brief?: unknown };
    return { paths: d.paths, brief: typeof d.brief === "string" ? d.brief.slice(0, 300) : "" };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { checkAiClipQuota, clipQuotaMessage } = await import("@/lib/plan.server");
    const q = await checkAiClipQuota(db, userId);
    if (!q.allowed) throw new Error(clipQuotaMessage(q));

    const { createClipJob, latestClientPhotos } = await import("@/lib/demo-video.server");
    const uploaded = ownPaths(userId, data.paths).map((p) => ({ bucket: "onboarding", path: p }));
    const photos = uploaded.length ? uploaded : await latestClientPhotos(db, userId);
    if (!photos.length) throw new Error("Încarcă 2–3 poze cu afacerea ta (locul, echipa sau ce lucrezi).");
    const id = await createClipJob(db, { userId, source: "web", brief: data.brief, photoRefs: photos });
    return { ok: true as const, id };
  });

/** Poză nouă din aplicație, pornind de la o poză a clientului (încărcată acum sau ultima trimisă). */
export const generatePhotoFromWeb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const d = (raw ?? {}) as { prompt?: unknown; refPath?: unknown };
    const prompt = typeof d.prompt === "string" ? d.prompt.trim().slice(0, 600) : "";
    if (prompt.length < 10) throw new Error("Descrie în câteva cuvinte ce poză vrei.");
    return { prompt, refPath: typeof d.refPath === "string" ? d.refPath : null };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { checkAiPhotoQuota, recordAiPhoto } = await import("@/lib/plan.server");
    const q = await checkAiPhotoQuota(db, userId);
    if (!q.allowed) {
      throw new Error(
        q.limit === 0
          ? "Pozele noi cu AI se deblochează după plata abonamentului: 10 pe lună pe Pro, nelimitat pe Premium."
          : `Ai folosit cele ${q.limit} poze AI din luna asta.`,
      );
    }
    let reference: { bytes: Uint8Array; mime: string } | null = null;
    if (data.refPath) {
      const [p] = ownPaths(userId, [data.refPath]);
      const { data: file } = await db.storage.from("onboarding").download(p);
      if (file) reference = { bytes: new Uint8Array(await file.arrayBuffer()), mime: "image/jpeg" };
    }
    const { generateCreativeImage } = await import("@/lib/wa-ai-extras.server");
    const img = await generateCreativeImage(userId, data.prompt, reference, { source: "web" });
    await recordAiPhoto(db, userId);
    return { ok: true as const, url: img.signedUrl };
  });
