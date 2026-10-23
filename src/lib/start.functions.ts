/**
 * Onboarding-ul nou (/start): întrebări → poze → conectare Facebook/TikTok →
 * clipul demo gratuit, livrat pe WhatsApp. Starea stă în `onboarding_sessions`.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StartGoal = "calls" | "forms" | "web" | "shop";
export type StartTarget = "fb" | "tt";
export type DemoStatus = "none" | "queued" | "running" | "ready" | "failed" | "delivered";

export type StartState = {
  hasSession: boolean;
  /** Cont creat cu telefonul, încă fără email real (pasul 2 din /start). */
  needsEmail: boolean;
  niche: string | null;
  goal: StartGoal | null;
  photos: Array<{ path: string; url: string | null }>;
  targets: StartTarget[];
  connected: { fb: boolean; tt: boolean };
  demo: {
    status: DemoStatus;
    /** 0–100, estimat după pasul curent al generării. */
    progress: number;
    step: string | null;
    error: string | null;
    videoUrl: string | null;
    imageUrls: string[];
  };
  completed: boolean;
};

const GOALS: StartGoal[] = ["calls", "forms", "web", "shop"];

async function signed(supabaseAdmin: any, paths: string[]): Promise<Array<string | null>> {
  if (!paths.length) return [];
  const { data } = await supabaseAdmin.storage.from("onboarding").createSignedUrls(paths, 60 * 60);
  return paths.map((p) => (data ?? []).find((d: any) => d.path === p)?.signedUrl ?? null);
}

export const getStartState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StartState> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    // Cât timp pagina e deschisă, fiecare citire avansează și generarea (cronul acoperă restul).
    const { data: pre } = await db
      .from("onboarding_sessions")
      .select("demo_status, template_sent_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (pre && (["queued", "running"].includes(pre.demo_status) || (pre.demo_status === "ready" && !pre.template_sent_at))) {
      try {
        const { advanceDemo } = await import("@/lib/demo-video.server");
        await advanceDemo(db, userId);
      } catch (e) {
        console.error("[start] advance on read failed", (e as Error).message);
      }
    }

    const [{ data: s }, { data: meta }, { data: tt }] = await Promise.all([
      db.from("onboarding_sessions").select("*").eq("user_id", userId).maybeSingle(),
      db.from("meta_connections").select("id").eq("user_id", userId).eq("is_active", true).limit(1).maybeSingle(),
      db.from("tiktok_connections").select("id").eq("user_id", userId).eq("is_active", true).limit(1).maybeSingle(),
    ]);

    const photoPaths: string[] = s?.photo_paths ?? [];
    const outPaths: string[] = [...(s?.demo_video_path ? [s.demo_video_path] : []), ...(s?.demo_image_paths ?? [])];
    const [photoUrls, outUrls] = await Promise.all([signed(db, photoPaths), signed(db, outPaths)]);
    const hasVideo = !!s?.demo_video_path;
    const { demoProgress } = await import("@/lib/demo-video.server");
    const prog = demoProgress(s?.demo_status ?? "none", s?.demo_job ?? {});

    const { data: au } = await supabaseAdmin.auth.admin.getUserById(userId);
    const { isPlaceholderEmail } = await import("@/lib/phone-auth.server");

    return {
      hasSession: !!s,
      needsEmail: isPlaceholderEmail(au?.user?.email),
      niche: s?.niche ?? null,
      goal: (s?.goal as StartGoal) ?? null,
      photos: photoPaths.map((p, i) => ({ path: p, url: photoUrls[i] ?? null })),
      targets: (s?.targets ?? []) as StartTarget[],
      connected: { fb: !!meta, tt: !!tt },
      demo: {
        status: (s?.demo_status ?? "none") as DemoStatus,
        progress: prog.progress,
        step: prog.step,
        error: s?.demo_status === "failed" ? "Clipul nu a putut fi creat. Încearcă din nou." : null,
        videoUrl: hasVideo ? (outUrls[0] ?? null) : null,
        imageUrls: (hasVideo ? outUrls.slice(1) : outUrls).filter(Boolean) as string[],
      },
      completed: !!s?.completed_at,
    };
  });

/** Pasul de email din /start: devine emailul contului (facturi, a doua cale de login). Fără cod. */
export const saveStartEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const email = String((raw as { email?: unknown })?.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) throw new Error("Introdu o adresă de email validă.");
    if (/@(phone|pending)\.adpilot\.ro$/.test(email)) throw new Error("Introdu adresa ta reală de email.");
    return { email };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await (supabaseAdmin as any).rpc("get_user_id_by_email", { p_email: data.email });
    if (existing && existing !== userId) {
      throw new Error("Emailul e folosit deja de alt cont AdPilot. Folosește altul sau intră cu el.");
    }
    const { data: cur } = await supabaseAdmin.auth.admin.getUserById(userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: data.email,
      email_confirm: true,
      user_metadata: { ...((cur?.user?.user_metadata as object) ?? {}), email_added_at: new Date().toISOString() },
    });
    if (error) throw new Error("Nu am putut salva emailul. Încearcă din nou.");
    return { ok: true as const };
  });

export const saveStartAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const d = (raw ?? {}) as { niche?: string; goal?: string | null };
    const niche = (d.niche ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (niche.length < 2) throw new Error("Spune-ne ce fel de afacere ai.");
    const goal = d.goal && GOALS.includes(d.goal as StartGoal) ? (d.goal as StartGoal) : null;
    return { niche, goal };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("onboarding_sessions")
      .upsert(
        { user_id: context.userId, niche: data.niche, goal: data.goal, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const saveStartPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const d = (raw ?? {}) as { paths?: unknown };
    const paths = Array.isArray(d.paths) ? d.paths.filter((p): p is string => typeof p === "string") : [];
    if (!paths.length) throw new Error("Adaugă cel puțin o poză.");
    return { paths: paths.slice(0, 5) };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.paths.some((p) => !p.startsWith(`${userId}/`) || p.includes(".."))) throw new Error("Poze invalide.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("onboarding_sessions")
      .update({ photo_paths: data.paths, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const saveStartTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const d = (raw ?? {}) as { targets?: unknown };
    const t = Array.isArray(d.targets) ? d.targets : [];
    const targets = (["fb", "tt"] as StartTarget[]).filter((x) => t.includes(x));
    if (!targets.length) throw new Error("Alege cel puțin o platformă.");
    return { targets };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("onboarding_sessions")
      .update({ targets: data.targets, updated_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Pornește clipul demo (unul gratuit per cont; se poate relua doar dacă a eșuat).
 * Cere pozele și conturile alese conectate. Generarea rulează din cron (demo-tick).
 */
export const startDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: s } = await db.from("onboarding_sessions").select("*").eq("user_id", userId).maybeSingle();
    if (!s) throw new Error("Începe de la primul pas.");
    if (!s.photo_paths?.length) throw new Error("Trimite întâi 2–3 poze.");
    if (s.demo_status !== "none" && s.demo_status !== "failed") return { ok: true as const, status: s.demo_status };

    const [{ data: meta }, { data: tt }] = await Promise.all([
      db.from("meta_connections").select("id").eq("user_id", userId).eq("is_active", true).limit(1).maybeSingle(),
      db.from("tiktok_connections").select("id").eq("user_id", userId).eq("is_active", true).limit(1).maybeSingle(),
    ]);
    const connected = { fb: !!meta, tt: !!tt };
    const targets: StartTarget[] = s.targets?.length ? s.targets : (["fb", "tt"] as StartTarget[]).filter((k) => connected[k]);
    if (!targets.length || targets.some((k) => !connected[k])) {
      throw new Error("Conectează întâi contul de Facebook sau TikTok.");
    }

    const now = new Date().toISOString();
    const { error } = await db
      .from("onboarding_sessions")
      .update({
        targets,
        demo_status: "queued",
        demo_job: {},
        demo_error: null,
        demo_started_at: now,
        completed_at: s.completed_at ?? now,
        updated_at: now,
      })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    // Primul pas pornește imediat (best-effort); cronul de la fiecare minut duce restul.
    try {
      const { advanceDemo } = await import("@/lib/demo-video.server");
      await advanceDemo(db, userId);
    } catch (e) {
      console.error("[start] first demo step failed", (e as Error).message);
    }
    return { ok: true as const, status: "queued" as const };
  });
