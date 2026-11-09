import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  chooseMetaPage,
  getAccountCheck,
  getCampaignDraft,
  getFlowState,
  listPagePhotos,
  saveCampaignDraft,
  type V3Page,
} from "@/lib/v3.functions";
import {
  AdPreview,
  FlowShell,
  FormPreview,
  Icon,
  Loading,
  autoText,
  errMsg,
  fmtLei,
  initials,
  useRequireSession,
  v3Head,
} from "@/components/v3/ui";

export const Route = createFileRoute("/campanie")({
  validateSearch: (s: Record<string, unknown>): { c?: string } => ({
    c: typeof s.c === "string" ? s.c : undefined,
  }),
  head: () =>
    v3Head("Fă-ți campania — AdPilot", undefined, [{ name: "robots", content: "noindex" }]),
  component: CampaignPage,
});

type Media =
  | { kind: "upload"; bucket: "onboarding"; path: string; mime: string; preview: string }
  | { kind: "url"; url: string; mime: string; preview: string }
  | null;

const RADII = [5, 10, 20, 40];

function ago(iso: string | null): string {
  if (!iso) return "fără postări recente";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "ultima postare azi";
  if (days < 2) return "ultima postare ieri";
  if (days < 30) return `ultima postare acum ${days} zile`;
  const months = Math.floor(days / 30);
  if (months < 12) return `ultima postare acum ${months === 1 ? "o lună" : `${months} luni`}`;
  const y = Math.floor(months / 12);
  return `ultima postare acum ${y === 1 ? "un an" : `${y} ani`}`;
}
const followersLabel = (n: number | null) =>
  n == null
    ? ""
    : `${n.toLocaleString("ro-RO")} ${n === 1 ? "urmăritor" : n < 20 ? "urmăritori" : "de urmăritori"}`;

/** O poză mare de pe telefon devine un JPEG de cel mult 1600 px, ca să urce repede. */
async function shrinkImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Nu pot citi poza."))), "image/jpeg", 0.86),
  );
}

function CampaignPage() {
  const session = useRequireSession();
  const { c: draftId } = Route.useSearch();
  const flowFn = useServerFn(getFlowState);
  const checkFn = useServerFn(getAccountCheck);
  const draftFn = useServerFn(getCampaignDraft);
  const choosePage = useServerFn(chooseMetaPage);
  const photosFn = useServerFn(listPagePhotos);
  const saveFn = useServerFn(saveCampaignDraft);

  const [ready, setReady] = useState(false);
  const [business, setBusiness] = useState("");
  const [pages, setPages] = useState<V3Page[]>([]);
  const [pageId, setPageId] = useState<string | null>(null);
  const [what, setWhat] = useState("");
  const [offer, setOffer] = useState("");
  const [city, setCity] = useState("");
  const [radius, setRadius] = useState(10);
  const [budget, setBudget] = useState(40);
  const [text, setText] = useState("");
  const [textEdited, setTextEdited] = useState(false);
  const [media, setMedia] = useState<Media>(null);
  const [uploading, setUploading] = useState(false);
  const [place, setPlace] = useState<"facebook" | "instagram">("facebook");
  const [dest, setDest] = useState<"form" | "wa">("form");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<string[] | null>(null);
  const [photosOpen, setPhotosOpen] = useState(false);
  const previewRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (session !== "ok") return;
    (async () => {
      const [f, check, d] = await Promise.all([
        flowFn().catch(() => null),
        checkFn({ data: { force: false } }).catch(() => null),
        draftId
          ? draftFn({ data: { id: draftId } }).catch(() => ({ draft: null }))
          : Promise.resolve({ draft: null }),
      ]);
      setBusiness(f?.businessName ?? "");
      const pg = check?.pages ?? [];
      setPages(pg);
      const draft = d?.draft;
      if (draft) {
        setWhat(draft.what);
        setOffer(draft.offer);
        setCity(draft.city);
        setRadius(draft.radius);
        setBudget(draft.budget);
        setText(draft.text);
        setTextEdited(true);
        setDest(draft.dest);
        setPageId(draft.pageId ?? pg.find((p) => p.active)?.pageId ?? pg[0]?.pageId ?? null);
        if (draft.mediaBucket === "onboarding" && draft.mediaPath && draft.mediaUrl)
          setMedia({
            kind: "upload",
            bucket: "onboarding",
            path: draft.mediaPath,
            mime: draft.mediaMime,
            preview: draft.mediaUrl,
          });
        else if (draft.mediaSource)
          setMedia({
            kind: "url",
            url: draft.mediaSource,
            mime: draft.mediaMime,
            preview: draft.mediaSource,
          });
      } else {
        setPageId(pg.find((p) => p.active)?.pageId ?? pg[0]?.pageId ?? null);
        try {
          const promo = localStorage.getItem("adpilot:v3-promo") ?? "";
          const m = promo.match(/^(.+?)\s+(?:în|in|din)\s+([^,]+)$/i);
          if (promo) {
            setWhat(m ? m[1].trim() : promo);
            if (m) setCity(m[2].trim());
          }
        } catch {
          /* fără stocare */
        }
      }
      setReady(true);
    })();
  }, [session, draftId, flowFn, checkFn, draftFn]);

  const page = pages.find((p) => p.pageId === pageId) ?? null;
  const pageName = page?.name || business || "Pagina ta";
  const shownText = textEdited ? text : autoText(what, offer, city, dest);
  const headline = `${what.trim() || "Serviciul tău"} în ${city.trim() || "orașul tău"}`;
  const month = budget * 30;
  const est = useMemo(
    () => ({ lo: Math.max(1, Math.round(month / 45)), hi: Math.round(month / 15) }),
    [month],
  );

  async function pickPage(id: string) {
    setPageId(id);
    setPhotos(null);
    try {
      await choosePage({ data: { pageId: id } });
    } catch {
      /* alegerea se salvează oricum în ciornă */
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    if (!isVideo && !file.type.startsWith("image/")) return setError("Alege o poză sau un clip.");
    if (isVideo && file.size > 80 * 1024 * 1024)
      return setError("Clipul e prea mare. Alege unul sub 80 MB.");
    setUploading(true);
    setError(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Intră din nou în cont.");
      const blob = isVideo ? file : await shrinkImage(file);
      const ext = isVideo ? (file.name.split(".").pop() || "mp4").toLowerCase() : "jpg";
      const mime = isVideo ? file.type || "video/mp4" : "image/jpeg";
      const path = `${u.user.id}/v3/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("onboarding")
        .upload(path, blob, { contentType: mime });
      if (upErr) throw new Error("Nu am putut încărca fișierul. Încearcă din nou.");
      setMedia({
        kind: "upload",
        bucket: "onboarding",
        path,
        mime,
        preview: URL.createObjectURL(blob),
      });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setUploading(false);
    }
  }

  async function openPhotos() {
    setPhotosOpen(true);
    if (photos) return;
    try {
      const r = await photosFn({ data: { pageId: pageId ?? "" } });
      setPhotos(r.photos);
    } catch {
      setPhotos([]);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (what.trim().length < 2) return setError("Scrie ce vrei să promovezi.");
    if (!media) return setError("Alege o poză sau un clip pentru reclamă.");
    if (city.trim().length < 2) return setError("Scrie orașul unde sunt clienții tăi.");
    setSaving(true);
    try {
      const r = await saveFn({
        data: {
          id: draftId ?? null,
          pageId,
          pageName,
          what,
          offer,
          city,
          radius,
          budget,
          text: shownText,
          media:
            media.kind === "upload"
              ? { bucket: media.bucket, path: media.path, mime: media.mime }
              : { url: media.url, mime: media.mime },
        },
      });
      window.location.href = `/plata?c=${r.id}`;
    } catch (err) {
      setError(errMsg(err));
      setSaving(false);
    }
  }

  if (session !== "ok" || !ready) return <Loading />;
  let k = 0;
  const N = () => ++k;
  const p = ((Math.min(150, budget) - 30) / 120) * 100;
  const isVideo = !!media && media.mime.startsWith("video/");

  return (
    <FlowShell step={2}>
      <h1>Fă-ți campania</h1>
      <p className="intro">
        Completezi câteva lucruri simple și vezi reclama exact cum o vor vedea oamenii.
      </p>
      <div className="cgrid">
        <form className="cform" id="cform" onSubmit={submit} noValidate>
          {pages.length > 1 ? (
            <div className="cstep">
              <span className="cnum">{N()}</span>
              <div>
                <h3>Pe ce pagină facem reclama?</h3>
                <p className="sub">
                  Am găsit {pages.length} pagini în contul tău. Alege-o pe cea a afacerii.
                </p>
                <div className="pages" role="radiogroup">
                  {pages.map((pg, i) => (
                    <button
                      key={pg.pageId}
                      type="button"
                      role="radio"
                      aria-checked={pg.pageId === pageId}
                      className={`pgopt${pg.pageId === pageId ? " on" : ""}`}
                      onClick={() => void pickPage(pg.pageId)}
                    >
                      <span className="ad-av">{initials(pg.name)}</span>
                      <span className="pg-txt">
                        <b>{pg.name}</b>
                        <small>
                          {[followersLabel(pg.followers), ago(pg.lastPost)]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </span>
                      {i === 0 && (pg.followers ?? 0) > 0 ? (
                        <span className="pg-rec">Cea mai activă</span>
                      ) : null}
                      <span className="pg-radio" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="cstep">
            <span className="cnum">{N()}</span>
            <div>
              <h3>Ce vrei să promovezi?</h3>
              <p className="sub">Un singur serviciu sau o singură ofertă merge cel mai bine.</p>
              <input
                className="input"
                value={what}
                onChange={(e) => setWhat(e.target.value)}
                placeholder="ex. Implant dentar"
                aria-label="Serviciul"
                maxLength={80}
              />
              <input
                className="input"
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="Prețul sau oferta (opțional), ex. de la 2.990 lei"
                aria-label="Oferta"
                maxLength={80}
              />
            </div>
          </div>

          <div className="cstep">
            <span className="cnum">{N()}</span>
            <div>
              <h3>Poză sau clip</h3>
              <p className="sub">Alege ce apare în reclamă.</p>
              <div className="media">
                {media ? (
                  <div className="mtile on">
                    {isVideo ? (
                      <video src={media.preview} muted autoPlay loop playsInline />
                    ) : (
                      <img src={media.preview} alt="Poza aleasă" />
                    )}
                    <span className="sel">
                      <Icon n="check" />
                    </span>
                  </div>
                ) : null}
                <label className="mtile">
                  <Icon n="upload" />
                  <span>
                    {uploading ? "Se încarcă…" : media ? "Alege alta" : "Încarcă din telefon"}
                  </span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => void onFile(e)}
                    aria-label="Încarcă o poză sau un clip"
                    disabled={uploading}
                  />
                </label>
                {pages.length ? (
                  <button type="button" className="mtile" onClick={() => void openPhotos()}>
                    <Icon n="grid" />
                    <span>Din postările paginii</span>
                  </button>
                ) : null}
              </div>
              <p className="tip">
                <Icon n="bulb" />
                <span>
                  Merge cel mai bine o poză reală din locul tău, nu una luată de pe internet.
                </span>
              </p>
            </div>
          </div>

          <div className="cstep">
            <span className="cnum">{N()}</span>
            <div>
              <h3>Unde sunt clienții tăi?</h3>
              <p className="sub">Vârsta și interesele le alegem noi, după ofertă.</p>
              <input
                className="input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Orașul"
                aria-label="Orașul"
                maxLength={60}
              />
              <div className="chips">
                {RADII.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`chip${r === radius ? " on" : ""}`}
                    onClick={() => setRadius(r)}
                  >
                    + {r} km
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="cstep">
            <span className="cnum">{N()}</span>
            <div>
              <h3>Cât vrei să dai pe zi?</h3>
              <p className="sub">
                Banii merg direct la Facebook, de pe cardul tău. Schimbi oricând.
              </p>
              <div className="budget-val">
                <b>{budget} lei</b>
                <span>pe zi</span>
              </div>
              <input
                type="range"
                min={30}
                max={150}
                step={5}
                value={Math.min(150, budget)}
                style={{ ["--p" as string]: `${p}%` }}
                onChange={(e) => setBudget(Number(e.target.value))}
                aria-label="Buget pe zi"
              />
              <div className="range-ends">
                <span>30 lei</span>
                <span>150 lei</span>
              </div>
              <div className="est">
                <div>
                  <small>Pe lună, la Facebook</small>
                  <b>≈ {fmtLei(month)} lei</b>
                </div>
                <div>
                  <small>Cereri estimate pe lună</small>
                  <b>
                    {est.lo}–{est.hi}
                  </b>
                </div>
              </div>
              <p className="est-note">Estimare orientativă. Depinde de ofertă, oraș și poză.</p>
            </div>
          </div>

          <div className="cstep">
            <span className="cnum">{N()}</span>
            <div>
              <h3>Textul reclamei</h3>
              <p className="sub">L-am scris noi din ce ai completat. Îl poți schimba.</p>
              <textarea
                className="input"
                rows={4}
                maxLength={500}
                value={shownText}
                onChange={(e) => {
                  setText(e.target.value);
                  setTextEdited(true);
                }}
                aria-label="Textul reclamei"
              />
            </div>
          </div>
        </form>

        <aside className="preview" ref={previewRef}>
          <div className="ptabs" role="tablist">
            {(["facebook", "instagram"] as const).map((pl) => (
              <button
                key={pl}
                type="button"
                role="tab"
                className={place === pl ? "on" : ""}
                onClick={() => setPlace(pl)}
              >
                {pl === "facebook" ? "Facebook" : "Instagram"}
              </button>
            ))}
          </div>
          <AdPreview
            place={place}
            pageName={pageName}
            text={shownText}
            headline={headline}
            mediaUrl={media?.preview ?? null}
            mediaIsVideo={isVideo}
            dest={dest}
            city={city}
          />
          <div style={{ marginTop: 14 }}>
            <FormPreview dest={dest} what={what} />
          </div>
          <p className="pnote">
            <Icon n="wa" />
            Cererea îți vine pe WhatsApp în câteva minute.
          </p>
        </aside>

        <button
          type="button"
          className="pv-jump"
          onClick={() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <Icon n="eye" />
          Vezi reclama
        </button>
        <div className="cfoot">
          {error ? (
            <p className="hint" style={{ color: "var(--bad)", width: "100%" }}>
              {error}
            </p>
          ) : null}
          <button className="btn btn-ink" type="submit" form="cform" disabled={saving || uploading}>
            {saving ? "Salvez…" : "Continuă la plată"} <Icon n="arrow" />
          </button>
          <span className="note">Nu plătești nimic până la pasul următor.</span>
        </div>
      </div>

      {photosOpen ? (
        <div
          className="overlay"
          onClick={(e) => e.target === e.currentTarget && setPhotosOpen(false)}
        >
          <div className="modal" style={{ maxWidth: 560, textAlign: "left" }}>
            <h3 style={{ marginTop: 0 }}>Postările paginii</h3>
            {photos == null ? (
              <div className="spin" style={{ margin: "24px auto" }} />
            ) : photos.length ? (
              <div className="media" style={{ marginTop: 16 }}>
                {photos.map((u) => (
                  <button
                    key={u}
                    type="button"
                    className="mtile"
                    onClick={() => {
                      setMedia({ kind: "url", url: u, mime: "image/jpeg", preview: u });
                      setPhotosOpen(false);
                    }}
                  >
                    <img src={u} alt="" />
                  </button>
                ))}
              </div>
            ) : (
              <p>Nu am găsit poze recente pe pagină. Încarcă una din telefon.</p>
            )}
            <button
              className="btn btn-line btn-block"
              style={{ marginTop: 18 }}
              onClick={() => setPhotosOpen(false)}
            >
              Închide
            </button>
          </div>
        </div>
      ) : null}
    </FlowShell>
  );
}
