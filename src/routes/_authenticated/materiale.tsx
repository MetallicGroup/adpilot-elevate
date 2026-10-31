import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Film, ImageIcon, Loader2, Paperclip, Sparkles, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import {
  createClipFromWeb,
  generatePhotoFromWeb,
  listMaterials,
  type MaterialsState,
} from "@/lib/materials.functions";

export const Route = createFileRoute("/_authenticated/materiale")({
  component: MaterialsPage,
  head: () => ({ meta: [{ title: "Materiale — AdPilot" }] }),
});

const SOURCE: Record<string, string> = { onboarding: "La înscriere", whatsapp: "Din WhatsApp", web: "Din aplicație" };

function fmtDate(s: string) {
  return new Date(s).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function toJpeg(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.86));
  } catch {
    return file;
  }
}

/** Încarcă pozele în folderul userului (bucket privat) și întoarce căile. */
async function uploadPhotos(files: File[]): Promise<string[]> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error("Sesiunea a expirat. Reîncarcă pagina.");
  const paths: string[] = [];
  for (const [i, f] of files.slice(0, 3).entries()) {
    const path = `${uid}/uploads/${Date.now()}_${i}.jpg`;
    const { error } = await supabase.storage.from("onboarding").upload(path, await toJpeg(f), { contentType: "image/jpeg" });
    if (error) throw new Error("Nu am putut încărca poza. Încearcă din nou.");
    paths.push(path);
  }
  return paths;
}

function MaterialsPage() {
  const fetchState = useServerFn(listMaterials);
  const startClip = useServerFn(createClipFromWeb);
  const makePhoto = useServerFn(generatePhotoFromWeb);
  const [state, setState] = useState<MaterialsState | null>(null);
  const [clipFiles, setClipFiles] = useState<File[]>([]);
  const [brief, setBrief] = useState("");
  const [clipBusy, setClipBusy] = useState(false);
  const [photoPrompt, setPhotoPrompt] = useState("");
  const [photoRef, setPhotoRef] = useState<File | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const clipInput = useRef<HTMLInputElement | null>(null);
  const photoInput = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await fetchState());
    } catch (e) {
      toast.error((e as Error).message || "Nu am putut încărca materialele.");
    }
  }, [fetchState]);

  useEffect(() => {
    void load();
  }, [load]);

  const working = (state?.jobs ?? []).some((j) => !j.failed);
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => void load(), 6000);
    return () => clearInterval(t);
  }, [working, load]);

  async function onNewClip() {
    setClipBusy(true);
    try {
      const paths = clipFiles.length ? await uploadPhotos(clipFiles) : [];
      await startClip({ data: { paths, brief } });
      toast.success("Am pornit clipul. Durează 10–15 minute; ți-l trimitem și pe WhatsApp.");
      setClipFiles([]);
      setBrief("");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setClipBusy(false);
    }
  }

  async function onNewPhoto() {
    setPhotoBusy(true);
    try {
      const refPath = photoRef ? (await uploadPhotos([photoRef]))[0] : null;
      await makePhoto({ data: { prompt: photoPrompt, refPath } });
      toast.success("Poza e gata.");
      setPhotoPrompt("");
      setPhotoRef(null);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }

  const q = state?.quota;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-24 sm:px-6 lg:px-10 lg:pt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="eyebrow">Studio AI</span>
          <h1 className="mt-3 text-[28px] font-bold leading-[1.05] tracking-[-0.045em] sm:text-[34px]">Materiale</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Clipurile și pozele create cu AI pentru reclamele tale, pe Facebook, Instagram și TikTok.
          </p>
        </div>
        {q ? (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border px-3 py-1.5">
              Clipuri noi luna asta: <b>{q.clips.used}</b> / {q.clips.limit}
            </span>
            <span className="rounded-full border px-3 py-1.5">
              Poze AI luna asta: <b>{q.photos.used}</b> / {q.photos.limit ?? "nelimitat"}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="card-floating p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Film className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold">Clip nou</h2>
              <p className="text-xs text-muted-foreground">20–25 de secunde, voce în română, subtitrări, plus 2 poze. Durează 10–15 minute.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" className="press inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm" onClick={() => clipInput.current?.click()}>
              <Paperclip className="h-4 w-4" />
              {clipFiles.length ? `${clipFiles.length} poze alese` : "Alege 2–3 poze (opțional)"}
            </button>
            <span className="text-xs text-muted-foreground">Fără poze noi, folosim ultimele tale poze.</span>
            <input
              ref={clipInput}
              id="mat-clip-files"
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                setClipFiles(Array.from(e.target.files ?? []).slice(0, 3));
                e.target.value = "";
              }}
            />
          </div>
          <Textarea
            id="mat-clip-brief"
            className="mt-3"
            rows={2}
            maxLength={300}
            placeholder="Ce vrei să scoatem în evidență? (opțional, ex: consultația gratuită)"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
          {q && !q.clips.allowed ? <p className="mt-3 text-sm text-muted-foreground">{q.clips.message}</p> : null}
          <button
            type="button"
            disabled={clipBusy || !q?.clips.allowed}
            onClick={() => void onNewClip()}
            className="press mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--gradient-primary)" }}
          >
            {clipBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Fă clipul
          </button>
        </section>

        <section className="card-floating p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <ImageIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold">Poză nouă</h2>
              <p className="text-xs text-muted-foreground">Pornim de la o poză reală a ta, ca locul și produsele să rămână ale tale.</p>
            </div>
          </div>
          <Textarea
            id="mat-photo-prompt"
            className="mt-4"
            rows={2}
            maxLength={600}
            placeholder="Ce poză vrei? (ex: medicul cu o pacientă zâmbind, lumină caldă)"
            value={photoPrompt}
            onChange={(e) => setPhotoPrompt(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="press inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm" onClick={() => photoInput.current?.click()}>
              <Paperclip className="h-4 w-4" />
              {photoRef ? "Poză de pornire aleasă" : "Poză de pornire (opțional)"}
            </button>
            <span className="text-xs text-muted-foreground">Fără ea, pornim de la ultima ta poză.</span>
            <input
              ref={photoInput}
              id="mat-photo-ref"
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                setPhotoRef(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </div>
          {q && !q.photos.allowed ? <p className="mt-3 text-sm text-muted-foreground">{q.photos.message}</p> : null}
          <button
            type="button"
            disabled={photoBusy || photoPrompt.trim().length < 10 || !q?.photos.allowed}
            onClick={() => void onNewPhoto()}
            className="press mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--gradient-primary)" }}
          >
            {photoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {photoBusy ? "Creez poza (~1 minut)…" : "Fă poza"}
          </button>
        </section>
      </div>

      {(state?.jobs ?? []).length ? (
        <div className="mt-6 grid gap-3">
          {state!.jobs.map((j) => (
            <div key={j.id} className="card-floating p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <b>{j.failed ? "Clipul nu a putut fi creat" : j.step ?? "În lucru"}</b>
                <span className="tabular-nums text-muted-foreground">{j.failed ? fmtDate(j.created_at) : `${j.progress}%`}</span>
              </div>
              {!j.failed ? (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full transition-all" style={{ width: `${j.progress}%`, background: "var(--gradient-primary)" }} />
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Nu s-a scăzut din limita ta. Încearcă din nou.</p>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Istoric</h2>
      {!state ? (
        <div className="mt-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : state.items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Încă nu ai materiale. Primul clip și primele 2 poze se creează la înscriere, din pozele tale.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {state.items.map((m) => (
            <figure key={m.id} className="card-floating overflow-hidden">
              {m.kind === "video" ? (
                <video src={m.url ?? undefined} controls playsInline preload="metadata" className="aspect-[9/16] w-full bg-black object-cover" />
              ) : (
                <img src={m.url ?? undefined} alt={m.prompt ?? "Poză generată cu AI"} loading="lazy" className="aspect-[4/5] w-full object-cover" />
              )}
              <figcaption className="flex items-center justify-between gap-2 p-3 text-xs">
                <span className="min-w-0">
                  <b className="block">{m.kind === "video" ? "Clip" : "Poză"}</b>
                  <span className="text-muted-foreground">
                    {SOURCE[m.source] ?? m.source} · {fmtDate(m.created_at)}
                  </span>
                </span>
                {m.url ? (
                  <a href={m.url} download className="press grid h-8 w-8 shrink-0 place-items-center rounded-lg border" aria-label="Descarcă">
                    <Download className="h-4 w-4" />
                  </a>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
