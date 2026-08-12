import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Copy, Loader2, Phone, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { buildLandingDraft, publishLandingPage, regenerateLandingPart } from "@/lib/goal-setup.functions";
import type { LandingCopy } from "@/lib/booking/types";

type Objective = "bookings" | "leads" | "calls";

type Draft = {
  objective: Objective;
  business_name: string;
  service: string;
  city: string | null;
  offer: string | null;
  phone: string | null;
  copy: LandingCopy;
  questions: Array<{
    key: string;
    label: string;
    type: string;
    options: string[];
    required: boolean;
    position: number;
    source: "preset" | "ai" | "user";
  }>;
};

const FIELD_LABEL: Record<Objective, { service: string; cta: string }> = {
  bookings: { service: "Ce serviciu vrei să promovezi?", cta: "Generează pagina de programări" },
  leads: { service: "Ce serviciu sau ofertă promovezi?", cta: "Generează pagina de ofertă" },
  calls: { service: "Ce serviciu oferi?", cta: "Generează pagina cu buton de apel" },
};

export function LandingBuilder({
  objective,
  defaults,
  onPublished,
}: {
  objective: Objective;
  defaults?: { business_name?: string | null; city?: string | null; phone?: string | null };
  onPublished?: (url: string) => void;
}) {
  const build = useServerFn(buildLandingDraft);
  const regen = useServerFn(regenerateLandingPart);
  const publish = useServerFn(publishLandingPage);

  const [form, setForm] = useState({
    business_name: defaults?.business_name ?? "",
    service: "",
    city: defaults?.city ?? "",
    offer: "",
    phone: defaults?.phone ?? "",
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [regenSection, setRegenSection] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  async function generate() {
    if (form.business_name.trim().length < 2) return toast.error("Scrie numele afacerii.");
    if (form.service.trim().length < 2) return toast.error("Scrie serviciul promovat.");
    if (objective === "calls" && form.phone.trim().length < 6)
      return toast.error("Scrie numărul de telefon pe care vrei să fii sunat.");
    setBusy(true);
    try {
      const d = await build({
        data: {
          objective,
          business_name: form.business_name.trim(),
          service: form.service.trim(),
          city: form.city.trim() || null,
          offer: form.offer.trim() || null,
          phone: form.phone.trim() || null,
        },
      });
      setDraft(d as Draft);
    } catch (e: any) {
      toast.error(e?.message ?? "Nu am putut genera pagina.");
    } finally {
      setBusy(false);
    }
  }

  async function another(section: "headline" | "subheadline" | "benefits" | "about") {
    if (!draft) return;
    setRegenSection(section);
    try {
      const patch = await regen({
        data: {
          objective,
          section,
          business_name: draft.business_name,
          service: draft.service,
          city: draft.city,
          copy: draft.copy as never,
        },
      });
      if (!patch || Object.keys(patch).length === 0) {
        toast.message("Varianta actuală rămâne cea mai bună.");
        return;
      }
      setDraft({ ...draft, copy: { ...draft.copy, ...(patch as Partial<LandingCopy>) } });
    } catch {
      toast.error("Nu am putut genera altă variantă.");
    } finally {
      setRegenSection(null);
    }
  }

  async function doPublish() {
    if (!draft) return;
    setBusy(true);
    try {
      const r = await publish({ data: draft as never });
      setUrl(r.url);
      onPublished?.(r.url);
      toast.success("Pagina ta este online.");
    } catch (e: any) {
      toast.error(e?.message ?? "Nu am putut publica pagina.");
    } finally {
      setBusy(false);
    }
  }

  function setCopy(patch: Partial<LandingCopy>) {
    if (!draft) return;
    setDraft({ ...draft, copy: { ...draft.copy, ...patch } });
  }

  if (url) {
    return (
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5">
        <p className="flex items-center gap-2 font-medium">
          <Check className="h-5 w-5 text-emerald-500" /> Pagina ta este online
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="break-all rounded-lg bg-background/60 px-3 py-2 text-sm text-primary underline"
          >
            {url}
          </a>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(url);
              toast.success("Link copiat");
            }}
            className="press inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs"
          >
            <Copy className="h-3.5 w-3.5" /> Copiază
          </button>
        </div>
        <Link
          to={objective === "bookings" ? "/programari" : "/create"}
          className="press btn-primary mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"
        >
          Pornește reclama către această pagină <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="space-y-3">
        <Field
          label="Cum se numește afacerea ta?"
          value={form.business_name}
          onChange={(v) => setForm({ ...form, business_name: v })}
          placeholder="Salon Eleganza"
        />
        <Field
          label={FIELD_LABEL[objective].service}
          value={form.service}
          onChange={(v) => setForm({ ...form, service: v })}
          placeholder="Tuns și coafat"
        />
        <Field
          label="În ce oraș?"
          value={form.city}
          onChange={(v) => setForm({ ...form, city: v })}
          placeholder="Cluj-Napoca"
        />
        <Field
          label="Ai o ofertă de start? (opțional)"
          value={form.offer}
          onChange={(v) => setForm({ ...form, offer: v })}
          placeholder="-20% la prima vizită"
        />
        {objective === "calls" && (
          <Field
            label="Pe ce număr vrei să te sune clienții?"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
            placeholder="07xx xxx xxx"
          />
        )}
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="press btn-primary mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold disabled:opacity-60 sm:w-auto"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {FIELD_LABEL[objective].cta}
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <EditableSection
          label="Titlu"
          busy={regenSection === "headline"}
          onRegenerate={() => another("headline")}
        >
          <textarea
            value={draft.copy.headline}
            onChange={(e) => setCopy({ headline: e.target.value })}
            rows={2}
            className="w-full resize-none rounded-xl border border-border bg-background/60 p-3 text-lg font-semibold outline-none focus:border-primary/60"
          />
        </EditableSection>

        <EditableSection
          label="Subtitlu"
          busy={regenSection === "subheadline"}
          onRegenerate={() => another("subheadline")}
        >
          <textarea
            value={draft.copy.subheadline}
            onChange={(e) => setCopy({ subheadline: e.target.value })}
            rows={2}
            className="w-full resize-none rounded-xl border border-border bg-background/60 p-3 text-sm outline-none focus:border-primary/60"
          />
        </EditableSection>

        <EditableSection
          label="Beneficii"
          busy={regenSection === "benefits"}
          onRegenerate={() => another("benefits")}
        >
          <div className="space-y-2">
            {draft.copy.benefits.map((b, i) => (
              <input
                key={i}
                value={b}
                onChange={(e) => {
                  const next = [...draft.copy.benefits];
                  next[i] = e.target.value;
                  setCopy({ benefits: next });
                }}
                className="w-full rounded-xl border border-border bg-background/60 p-2.5 text-sm outline-none focus:border-primary/60"
              />
            ))}
          </div>
        </EditableSection>

        <EditableSection label="Despre" busy={regenSection === "about"} onRegenerate={() => another("about")}>
          <textarea
            value={draft.copy.about}
            onChange={(e) => setCopy({ about: e.target.value })}
            rows={4}
            className="w-full resize-none rounded-xl border border-border bg-background/60 p-3 text-sm outline-none focus:border-primary/60"
          />
        </EditableSection>

        {draft.questions.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Întrebări de calificare
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {draft.questions.map((q) => (
                <li key={q.key} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {q.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={doPublish}
            disabled={busy}
            className="press btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Publică pagina
          </button>
          <button
            type="button"
            onClick={() => setDraft(null)}
            className="press inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm"
          >
            Modifică datele
          </button>
        </div>
      </div>

      <PhonePreview draft={draft} />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-border bg-background/60 px-3.5 py-3 text-sm outline-none focus:border-primary/60"
      />
    </label>
  );
}

function EditableSection({
  label,
  busy,
  onRegenerate,
  children,
}: {
  label: string;
  busy: boolean;
  onRegenerate: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={busy}
          className="press inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} altă variantă
        </button>
      </div>
      {children}
    </div>
  );
}

function PhonePreview({ draft }: { draft: Draft }) {
  return (
    <div className="mx-auto w-full max-w-[320px]">
      <div className="rounded-[2.2rem] border border-border bg-card/60 p-3 shadow-[var(--shadow-glow)]">
        <div className="h-[520px] overflow-y-auto rounded-[1.6rem] bg-background p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {draft.business_name}
            {draft.city ? ` · ${draft.city}` : ""}
          </p>
          <h3 className="mt-2 text-xl font-semibold leading-tight">{draft.copy.headline}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{draft.copy.subheadline}</p>
          {draft.copy.offer_label && (
            <p className="mt-3 inline-block rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
              {draft.copy.offer_label}
            </p>
          )}
          <button
            type="button"
            className="press btn-primary mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold"
          >
            {draft.objective === "calls" && <Phone className="h-4 w-4" />}
            {draft.copy.cta_label}
          </button>
          <ul className="mt-5 space-y-2">
            {draft.copy.benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {b}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{draft.copy.about}</p>
          {draft.objective === "bookings" && (
            <div className="mt-5 rounded-xl border border-border p-3">
              <p className="text-xs font-medium">Alege ziua și ora</p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {["09:00", "10:30", "12:00", "14:00", "15:30", "17:00"].map((t) => (
                  <span key={t} className="rounded-lg border border-border py-1 text-center text-[11px]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">Previzualizare pe telefon</p>
    </div>
  );
}
