import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Target, TrendingUp, Calendar, MapPin, Sparkles, Image as ImageIcon, FileText, Check, Music2, Facebook, Upload, Loader2, Plus, X } from "lucide-react";
import { WizardShell, FieldLabel, ChoiceCard, Chip } from "@/components/wizard/WizardShell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { saveCampaign } from "@/lib/campaigns.functions";
import { checkMetaReady, listMetaPages } from "@/lib/leads.functions";
import { publishMetaCampaign, uploadAdMedia } from "@/lib/meta-publish.functions";
import { fmtMoney } from "@/lib/format";
import { AdPreview } from "@/components/wizard/AdPreview";
import { loadDraft, saveDraft, clearDraft } from "@/lib/wizard-draft";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/create")({
  component: CreateWizard,
});

type Objective = "LEAD_GENERATION" | "CONVERSIONS";
type BudgetMode = "BUDGET_MODE_DAY" | "BUDGET_MODE_TOTAL";
type Platform = "tiktok" | "meta";

type State = {
  platform: Platform;
  name: string;
  objective: Objective;
  budget: number;
  budget_mode: BudgetMode;
  start_date: string;
  end_date: string;
  locations: string[];
  age_groups: string[];
  genders: string[];
  interests: string[];
  languages: string[];
  headline: string;
  description: string;
  cta: string;
  media_url: string;
  landing_url: string;
  lf_title: string;
  lf_intro: string;
  lf_fields: string[];
  lf_custom_questions: string[];
  lf_privacy_url: string;
  page_id: string;
};

const LOCATIONS = ["România", "Republica Moldova", "Marea Britanie", "Germania", "Italia", "Spania", "Franța", "SUA"];
const AGES = ["13-17", "18-24", "25-34", "35-44", "45-54", "55+"];
const GENDERS = ["Toți", "Femei", "Bărbați"];
const INTERESTS = ["Frumusețe", "Modă", "Fitness", "Food", "Gaming", "Tech", "Călătorii", "Finanțe", "Educație", "Casă", "Animale", "Auto"];
const LANGUAGES = ["Română", "Engleză", "Maghiară", "Germană"];
const CTAS = ["Află mai mult", "Înscrie-te", "Cumpără acum", "Descarcă", "Aplică acum", "Rezervă acum"];
const LEAD_FIELDS = ["Nume", "Email", "Telefon", "Oraș", "Cod poștal", "Companie", "Funcție"];

function CreateWizard() {
  const navigate = useNavigate();
  const submit = useServerFn(saveCampaign);
  const checkMeta = useServerFn(checkMetaReady);
  const fetchPages = useServerFn(listMetaPages);
  const publishMeta = useServerFn(publishMetaCampaign);
  const uploadMedia = useServerFn(uploadAdMedia);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [pages, setPages] = useState<{ page_id: string; page_name: string }[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [s, setS] = useState<State>({
    platform: "meta",
    name: "",
    objective: "LEAD_GENERATION",
    budget: 50,
    budget_mode: "BUDGET_MODE_DAY",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    locations: ["United States"],
    age_groups: ["18-24", "25-34"],
    genders: ["All"],
    interests: [],
    languages: ["English"],
    headline: "",
    description: "",
    cta: "Learn More",
    media_url: "",
    landing_url: "",
    lf_title: "",
    lf_intro: "",
    lf_fields: ["Name", "Phone"],
    lf_custom_questions: [],
    lf_privacy_url: "",
    page_id: "",
  });

  // Hydrate draft from localStorage once
  const [draftRestored, setDraftRestored] = useState(false);
  useEffect(() => {
    const d = loadDraft<State>();
    if (d) { setS(d); toast.success("Draft restaurat ✨", { duration: 2000 }); }
    setDraftRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave on change (debounced)
  useEffect(() => {
    if (!draftRestored) return;
    const t = setTimeout(() => saveDraft(s), 400);
    return () => clearTimeout(t);
  }, [s, draftRestored]);

  const update = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));
  const toggle = <K extends keyof State>(k: K, v: string) => {
    const arr = s[k] as unknown as string[];
    update(k, (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]) as State[K]);
  };

  // Load pages when Meta is selected
  useEffect(() => {
    if (s.platform !== "meta") return;
    setPagesLoading(true);
    fetchPages()
      .then((r) => {
        setPages(r.pages);
        setS((p) => (p.page_id || r.pages.length === 0 ? p : { ...p, page_id: r.pages[0].page_id }));
      })
      .catch(() => {})
      .finally(() => setPagesLoading(false));
  }, [s.platform, fetchPages]);

  const total = s.objective === "LEAD_GENERATION" ? 6 : 5;

  const canNext = useMemo(() => {
    switch (step) {
      case 1: return s.name.trim().length > 0 && !!s.objective;
      case 2: return s.budget >= 5 && !!s.start_date;
      case 3: return s.locations.length > 0 && s.age_groups.length > 0;
      case 4: return s.headline.trim().length > 0 && s.landing_url.trim().length > 0;
      case 5: return s.objective === "CONVERSIONS"
        ? true
        : (s.lf_title.trim().length > 0
            && (s.lf_fields.length > 0 || s.lf_custom_questions.some((q) => q.trim().length > 0))
            && (s.platform !== "meta" || !!s.page_id));
      case 6: return true;
      default: return false;
    }
  }, [step, s]);

  const titles = [
    { t: "Care e obiectivul tău? 🎯", sub: "Optimizăm livrarea în funcție de ce vrei să obții." },
    { t: "Setează bugetul 💰", sub: "Începe mic — poți scala oricând." },
    { t: "Cine să vadă reclama? 👥", sub: "Rafinează audiența după locație, vârstă și interese." },
    { t: "Creativul tău ✨", sub: "Fă ceva ce oprește scrollul." },
    { t: s.objective === "LEAD_GENERATION" ? "Designul formularului 📋" : "Verifică campania 🚀", sub: s.objective === "LEAD_GENERATION" ? "Cere doar info esențiale — păstrează-l scurt." : "Verifică totul înainte de lansare." },
    { t: "Verifică campania 🚀", sub: "Verifică totul înainte de lansare." },
  ];

  const onNext = async () => {
    if (step < total) { setStep(step + 1); return; }
    // Final step → open confirmation dialog
    setConfirmOpen(true);
  };

  const doPublish = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      if (s.platform === "meta") {
        const r = await checkMeta();
        if (!r.ready) {
          toast.error(
            r.reason === "no_pages"
              ? "Conectează cel puțin o pagină Facebook în Setări înainte de a publica pe Meta."
              : "Conectează contul Meta în Setări înainte de a publica.",
            {
              action: { label: "Deschide Setări", onClick: () => navigate({ to: "/settings" }) },
            },
          );
          setSubmitting(false);
          return;
        }
      }
      const saved = await submit({
        data: {
          platform: s.platform,
          name: s.name.trim(),
          objective: s.objective,
          budget: s.budget,
          budget_mode: s.budget_mode,
          start_date: s.start_date || null,
          end_date: s.end_date || null,
          targeting: {
            locations: s.locations,
            age_groups: s.age_groups,
            genders: s.genders,
            interests: s.interests,
            languages: s.languages,
          },
          creative: {
            headline: s.headline.trim(),
            description: s.description.trim(),
            cta: s.cta,
            media_url: s.media_url.trim(),
            landing_url: s.landing_url.trim(),
          },
          lead_form: s.objective === "LEAD_GENERATION" ? {
            title: s.lf_title.trim(),
            intro: s.lf_intro.trim(),
            fields: s.lf_fields,
            custom_questions: s.lf_custom_questions.map((q) => q.trim()).filter(Boolean),
            privacy_url: s.lf_privacy_url.trim(),
          } : null,
          status: "draft",
        },
      });

      if (s.platform === "meta") {
        toast.loading("Publishing to Meta…", { id: "publish" });
        try {
          await publishMeta({ data: { campaign_id: saved.id, page_id: s.page_id || undefined } });
          toast.success("Live pe Meta! 🎉", { id: "publish" });
          clearDraft();
          navigate({ to: "/campaigns/$id", params: { id: saved.id } });
          return;
        } catch (e: any) {
          toast.error(e?.message ?? "Publicare Meta eșuată", { id: "publish", duration: 8000 });
        }
      } else {
        toast.success("Campanie salvată ca draft 💾");
        clearDraft();
      }
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e?.message ?? "Nu am putut salva campania");
    } finally {
      setSubmitting(false);
    }
  };

  const onBack = () => (step > 1 ? setStep(step - 1) : navigate({ to: "/dashboard" }));

  const onUploadMedia = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Imaginea trebuie să fie sub 8 MB");
      return;
    }
    setUploadingMedia(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const result = r.result as string;
          resolve(result.split(",")[1]);
        };
        r.onerror = () => reject(new Error("Read failed"));
        r.readAsDataURL(file);
      });
      const { url } = await uploadMedia({
        data: { filename: file.name, contentType: file.type || "image/jpeg", base64 },
      });
      update("media_url", url);
      toast.success("Imagine încărcată ✨");
    } catch (e: any) {
      toast.error(e?.message ?? "Încărcare eșuată");
    } finally {
      setUploadingMedia(false);
    }
  };

  const idx = step - 1;
  const isLast = step === total;

  return (
    <>
    <WizardShell
      step={step}
      total={total}
      title={titles[idx].t}
      subtitle={titles[idx].sub}
      canBack={true}
      canNext={canNext}
      nextLabel={isLast ? (s.platform === "meta" ? "Verifică și publică" : "Salvează campania") : "Continuă"}
      onBack={onBack}
      onNext={onNext}
      isSubmitting={submitting}
    >
      {step === 1 && <StepGoal s={s} update={update} />}
      {step === 2 && <StepBudget s={s} update={update} />}
      {step === 3 && <StepAudience s={s} toggle={toggle} />}
      {step === 4 && <StepCreative s={s} update={update} onUploadMedia={onUploadMedia} uploadingMedia={uploadingMedia} />}
      {step === 5 && s.objective === "LEAD_GENERATION" && <StepLeadForm s={s} update={update} toggle={toggle} pages={pages} pagesLoading={pagesLoading} />}
      {((step === 5 && s.objective === "CONVERSIONS") || step === 6) && (
        <StepReview s={s} pageName={pages.find((p) => p.page_id === s.page_id)?.page_name ?? ""} />
      )}
    </WizardShell>

    <aside className="hidden xl:block fixed top-20 right-6 w-[360px] z-30 max-h-[calc(100vh-7rem)] overflow-y-auto">
      <div className="rounded-2xl border border-border bg-background/80 backdrop-blur-xl shadow-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Preview live</p>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/20">💾 salvat</span>
        </div>
        <AdPreview
          pageName={pages.find((p) => p.page_id === s.page_id)?.page_name || (s.platform === "meta" ? "Pagina ta" : s.name || "Brandul tău")}
          headline={s.headline}
          description={s.description}
          cta={s.cta}
          mediaUrl={s.media_url}
          landingUrl={s.landing_url}
        />
        <LiveEstimates s={s} />
      </div>
    </aside>

    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {s.platform === "meta" ? "Publici live pe Meta? 🚀" : "Salvezi campania?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {s.platform === "meta" ? (
              <>
                Reclama va deveni <strong>ACTIVĂ</strong> imediat și va începe să cheltuiască buget real:
                <span className="block mt-1 text-foreground font-medium">
                  {fmtMoney(s.budget)} {s.budget_mode === "BUDGET_MODE_DAY" ? "pe zi" : "în total"}
                </span>
                Poți pune oricând pe pauză din pagina campaniei.
              </>
            ) : (
              "Campania va fi salvată ca draft."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Înapoi</AlertDialogCancel>
          <AlertDialogAction onClick={doPublish}>
            {s.platform === "meta" ? "Da, publică" : "Salvează"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function StepGoal({ s, update }: { s: State; update: <K extends keyof State>(k: K, v: State[K]) => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <FieldLabel>Platformă</FieldLabel>
        <div className="grid grid-cols-1 gap-3">
          <ChoiceCard active={s.platform === "meta"} onClick={() => update("platform", "meta")}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1877F2] text-white flex items-center justify-center">
                <Facebook className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-foreground">Meta Ads</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Facebook & Instagram</div>
              </div>
            </div>
          </ChoiceCard>
        </div>
      </div>
      <div>
        <FieldLabel>Numele campaniei</FieldLabel>
        <Input
          value={s.name}
          onChange={(e) => update("name", e.target.value.slice(0, 120))}
          placeholder="Lansare vară — lead-uri"
          className="h-12 rounded-xl"
        />
      </div>
      <div className="space-y-3">
        <FieldLabel>Obiectiv</FieldLabel>
        <ChoiceCard active={s.objective === "LEAD_GENERATION"} onClick={() => update("objective", "LEAD_GENERATION")}>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Generare lead-uri</div>
              <div className="mt-0.5 text-sm text-muted-foreground">Colectează contacte printr-un formular integrat.</div>
            </div>
          </div>
        </ChoiceCard>
        <ChoiceCard active={s.objective === "CONVERSIONS"} onClick={() => update("objective", "CONVERSIONS")}>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Conversii</div>
              <div className="mt-0.5 text-sm text-muted-foreground">Generează achiziții sau înscrieri pe site-ul tău.</div>
            </div>
          </div>
        </ChoiceCard>
      </div>
    </div>
  );
}

function StepBudget({ s, update }: { s: State; update: <K extends keyof State>(k: K, v: State[K]) => void }) {
  return (
    <div className="space-y-8">
      <div>
        <FieldLabel>Tip buget</FieldLabel>
        <div className="flex gap-2">
          <Chip active={s.budget_mode === "BUDGET_MODE_DAY"} onClick={() => update("budget_mode", "BUDGET_MODE_DAY")}>Zilnic</Chip>
          <Chip active={s.budget_mode === "BUDGET_MODE_TOTAL"} onClick={() => update("budget_mode", "BUDGET_MODE_TOTAL")}>Total</Chip>
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <FieldLabel>{s.budget_mode === "BUDGET_MODE_DAY" ? "Buget zilnic" : "Buget total"}</FieldLabel>
          <div className="font-serif text-3xl font-semibold tabular-nums">{fmtMoney(s.budget)}</div>
        </div>
        <Slider
          min={5}
          max={s.budget_mode === "BUDGET_MODE_DAY" ? 500 : 10000}
          step={5}
          value={[s.budget]}
          onValueChange={(v) => update("budget", v[0])}
          className="mt-4"
        />
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>{fmtMoney(5)}</span>
          <span>{fmtMoney(s.budget_mode === "BUDGET_MODE_DAY" ? 500 : 10000)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel><Calendar className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />Început</FieldLabel>
          <Input type="date" value={s.start_date} onChange={(e) => update("start_date", e.target.value)} className="h-12 rounded-xl" />
        </div>
        <div>
          <FieldLabel><Calendar className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />Sfârșit (opțional)</FieldLabel>
          <Input type="date" value={s.end_date} onChange={(e) => update("end_date", e.target.value)} className="h-12 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function StepAudience({ s, toggle }: { s: State; toggle: <K extends keyof State>(k: K, v: string) => void }) {
  return (
    <div className="space-y-7">
      <Section icon={<MapPin className="w-4 h-4" />} label="Locații">
        <div className="flex flex-wrap gap-2">
          {LOCATIONS.map((l) => (
            <Chip key={l} active={s.locations.includes(l)} onClick={() => toggle("locations", l)}>{l}</Chip>
          ))}
        </div>
      </Section>
      <Section label="Vârstă">
        <div className="flex flex-wrap gap-2">
          {AGES.map((a) => (
            <Chip key={a} active={s.age_groups.includes(a)} onClick={() => toggle("age_groups", a)}>{a}</Chip>
          ))}
        </div>
      </Section>
      <Section label="Gen">
        <div className="flex flex-wrap gap-2">
          {GENDERS.map((g) => (
            <Chip key={g} active={s.genders.includes(g)} onClick={() => toggle("genders", g)}>{g}</Chip>
          ))}
        </div>
      </Section>
      <Section icon={<Sparkles className="w-4 h-4" />} label="Interese">
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => (
            <Chip key={i} active={s.interests.includes(i)} onClick={() => toggle("interests", i)}>{i}</Chip>
          ))}
        </div>
      </Section>
      <Section label="Limbi">
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <Chip key={l} active={s.languages.includes(l)} onClick={() => toggle("languages", l)}>{l}</Chip>
          ))}
        </div>
      </Section>
    </div>
  );
}

function StepCreative({ s, update, onUploadMedia, uploadingMedia }: {
  s: State;
  update: <K extends keyof State>(k: K, v: State[K]) => void;
  onUploadMedia: (file: File) => Promise<void>;
  uploadingMedia: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <FieldLabel><ImageIcon className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />Imagine</FieldLabel>
        <label className="press flex items-center gap-3 h-12 px-4 rounded-xl border border-dashed border-border hover:bg-secondary cursor-pointer">
          {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          <span className="text-sm text-muted-foreground truncate">
            {uploadingMedia ? "Se încarcă…" : s.media_url ? "Înlocuiește imaginea" : "Încarcă imagine (JPG/PNG, max 8 MB)"}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadMedia(f); e.target.value = ""; }}
          />
        </label>
        {s.media_url && (
          <p className="mt-1.5 text-[11px] text-muted-foreground truncate">Încărcată ✓</p>
        )}
        <Input
          value={s.media_url}
          onChange={(e) => update("media_url", e.target.value)}
          placeholder="…sau lipește un URL"
          className="mt-2 h-10 rounded-xl text-xs"
        />
      </div>
      <div>
        <FieldLabel>Titlu</FieldLabel>
        <Input value={s.headline} onChange={(e) => update("headline", e.target.value.slice(0, 80))} placeholder="Modul mai inteligent de a lansa" className="h-12 rounded-xl" />
        <p className="mt-1.5 text-[11px] text-muted-foreground">{s.headline.length}/80</p>
      </div>
      <div>
        <FieldLabel>Descriere</FieldLabel>
        <Textarea value={s.description} onChange={(e) => update("description", e.target.value.slice(0, 280))} placeholder="Spune-le oamenilor de ce ar trebui să le pese." className="rounded-xl min-h-24" />
        <p className="mt-1.5 text-[11px] text-muted-foreground">{s.description.length}/280</p>
      </div>
      <div>
        <FieldLabel>Buton acțiune</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {CTAS.map((c) => (
            <Chip key={c} active={s.cta === c} onClick={() => update("cta", c)}>{c}</Chip>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>URL landing page</FieldLabel>
        <Input value={s.landing_url} onChange={(e) => update("landing_url", e.target.value)} placeholder="https://brandul-tau.ro/oferta" className="h-12 rounded-xl" />
      </div>
    </div>
  );
}

function StepLeadForm({ s, update, toggle, pages, pagesLoading }: {
  s: State;
  update: <K extends keyof State>(k: K, v: State[K]) => void;
  toggle: <K extends keyof State>(k: K, v: string) => void;
  pages: { page_id: string; page_name: string }[];
  pagesLoading: boolean;
}) {
  const addQuestion = () => update("lf_custom_questions", [...s.lf_custom_questions, ""]);
  const setQuestion = (i: number, v: string) => {
    const next = [...s.lf_custom_questions];
    next[i] = v.slice(0, 200);
    update("lf_custom_questions", next);
  };
  const removeQuestion = (i: number) => {
    update("lf_custom_questions", s.lf_custom_questions.filter((_, idx) => idx !== i));
  };
  return (
    <div className="space-y-6">
      {s.platform === "meta" && (
        <div>
          <FieldLabel><Facebook className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />Pagină Facebook</FieldLabel>
          {pagesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground h-12 px-4 rounded-xl border border-border">
              <Loader2 className="w-4 h-4 animate-spin" /> Se încarcă paginile…
            </div>
          ) : pages.length === 0 ? (
            <div className="text-sm text-muted-foreground h-12 px-4 flex items-center rounded-xl border border-dashed border-border">
              Nicio pagină conectată. Conectează una în Setări.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pages.map((p) => (
                <Chip key={p.page_id} active={s.page_id === p.page_id} onClick={() => update("page_id", p.page_id)}>
                  {p.page_name}
                </Chip>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-[11px] text-muted-foreground">Lead-urile vor fi livrate către această pagină.</p>
        </div>
      )}
      <div>
        <FieldLabel><FileText className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />Titlu formular</FieldLabel>
        <Input value={s.lf_title} onChange={(e) => update("lf_title", e.target.value.slice(0, 120))} placeholder="Primește acces în avanpremieră" className="h-12 rounded-xl" />
      </div>
      <div>
        <FieldLabel>Mesaj de intro</FieldLabel>
        <Textarea value={s.lf_intro} onChange={(e) => update("lf_intro", e.target.value.slice(0, 500))} placeholder="Spune-ne câte ceva despre tine — te contactăm în 24 de ore." className="rounded-xl min-h-20" />
      </div>
      <div>
        <FieldLabel>Câmpuri standard</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {LEAD_FIELDS.map((f) => (
            <Chip key={f} active={s.lf_fields.includes(f)} onClick={() => toggle("lf_fields", f)}>{f}</Chip>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">Pre-completate din profilul Facebook al utilizatorului când e posibil.</p>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <FieldLabel>Întrebări personalizate</FieldLabel>
          <button
            type="button"
            onClick={addQuestion}
            className="press inline-flex items-center gap-1 text-xs font-medium text-foreground hover:opacity-70"
          >
            <Plus className="w-3.5 h-3.5" /> Adaugă întrebare
          </button>
        </div>
        {s.lf_custom_questions.length === 0 ? (
          <p className="mt-2 text-[12px] text-muted-foreground">
            Vrei să afli mai mult decât nume și telefon? Adaugă întrebări proprii (ex: „Ce serviciu te interesează?", „Când e cel mai bine să te sunăm?").
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {s.lf_custom_questions.map((q, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={q}
                  onChange={(e) => setQuestion(i, e.target.value)}
                  placeholder="Scrie întrebarea ta…"
                  className="h-11 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => removeQuestion(i)}
                  className="press w-11 h-11 flex items-center justify-center rounded-xl border border-border hover:bg-secondary text-muted-foreground"
                  aria-label="Șterge întrebarea"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <FieldLabel>URL politică de confidențialitate</FieldLabel>
        <Input value={s.lf_privacy_url} onChange={(e) => update("lf_privacy_url", e.target.value)} placeholder="https://brandul-tau.ro/privacy" className="h-12 rounded-xl" />
      </div>
    </div>
  );
}

function StepReview({ s, pageName }: { s: State; pageName: string }) {
  return (
    <div className="space-y-3">
      <AdPreview
        pageName={pageName || (s.platform === "meta" ? "Pagina ta Facebook" : s.name)}
        headline={s.headline}
        description={s.description}
        cta={s.cta}
        mediaUrl={s.media_url}
        landingUrl={s.landing_url}
      />
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground pt-3">Preview · cum va apărea în feed</div>
      <ReviewRow label="Platformă" value={s.platform === "tiktok" ? "TikTok Ads" : "Meta Ads (Facebook & Instagram)"} />
      <ReviewRow label="Nume" value={s.name} />
      <ReviewRow label="Obiectiv" value={s.objective === "LEAD_GENERATION" ? "Generare lead-uri" : "Conversii"} />
      <ReviewRow label="Buget" value={`${fmtMoney(s.budget)} ${s.budget_mode === "BUDGET_MODE_DAY" ? "/ zi" : "total"}`} />
      <ReviewRow label="Program" value={`${s.start_date}${s.end_date ? ` → ${s.end_date}` : " · continuu"}`} />
      <ReviewRow label="Locații" value={s.locations.join(", ") || "—"} />
      <ReviewRow label="Vârstă" value={s.age_groups.join(", ") || "—"} />
      <ReviewRow label="Gen" value={s.genders.join(", ") || "—"} />
      <ReviewRow label="Interese" value={s.interests.length ? s.interests.join(", ") : "Oricare"} />
      <ReviewRow label="Limbi" value={s.languages.join(", ") || "—"} />
      <ReviewRow label="Titlu" value={s.headline} />
      <ReviewRow label="CTA" value={s.cta} />
      <ReviewRow label="URL landing" value={s.landing_url} />
      {s.objective === "LEAD_GENERATION" && (
        <>
          <ReviewRow label="Formular" value={s.lf_title} />
          <ReviewRow label="Câmpuri" value={s.lf_fields.join(", ")} />
        </>
      )}
      <div className="mt-6 card-floating p-4 flex items-start gap-3 text-sm">
        <Check className="w-4 h-4 mt-0.5 text-foreground" />
        <div className="text-muted-foreground">
          Salvată ca draft în workspace-ul tău. Conectează {s.platform === "tiktok" ? "TikTok" : "Meta"} în Setări pentru publicare live.
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground text-right max-w-[60%] break-words">{value || "—"}</div>
    </div>
  );
}

function LiveEstimates({ s }: { s: State }) {
  const dailyBudget = s.budget_mode === "BUDGET_MODE_DAY" ? s.budget : s.budget / 14;
  const cpm = s.platform === "tiktok" ? 4.2 : 6.8;
  const reachLow = Math.round((dailyBudget / cpm) * 1000 * 0.8);
  const reachHigh = Math.round((dailyBudget / cpm) * 1000 * 1.4);
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3 space-y-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">📊 Estimări zilnice</p>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-background/60 p-2">
          <p className="text-[10px] text-muted-foreground">Reach</p>
          <p className="font-mono text-sm font-semibold mt-0.5">{fmt(reachLow)}–{fmt(reachHigh)}</p>
        </div>
        <div className="rounded-lg bg-background/60 p-2">
          <p className="text-[10px] text-muted-foreground">CPM estimat</p>
          <p className="font-mono text-sm font-semibold mt-0.5">€{cpm.toFixed(2)}</p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Bazat pe medii {s.platform === "tiktok" ? "TikTok" : "Meta"} pentru audiențe similare. Reach real variază în funcție de creative.
      </p>
    </div>
  );
}

function Section({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <FieldLabel>{icon}<span className={icon ? "ml-1.5" : ""}>{label}</span></FieldLabel>
      {children}
    </div>
  );
}