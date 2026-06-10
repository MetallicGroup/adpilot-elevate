import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  MapPin,
  ImagePlus,
  X,
  Check,
  RefreshCw,
  Facebook,
  Wand2,
} from "lucide-react";
import { WizardShell, FieldLabel, ChoiceCard, Chip } from "@/components/wizard/WizardShell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PROMOTION_GOALS,
  BUSINESS_NICHES,
  BUDGET_PRESETS_RON,
  DEFAULT_LEAD_FIELDS,
  OPTIONAL_LEAD_FIELDS,
  suggestLeadFields,
} from "@/lib/launcher/presets";
import type {
  BusinessNiche,
  GeneratedAdCopy,
  LauncherSimpleAnswers,
  LeadFieldConfig,
  PromotionGoal,
} from "@/lib/launcher/types";
import {
  generateLauncherCampaign,
  getLauncherPlatformStatus,
  launchLauncherCampaign,
} from "@/lib/launcher.functions";
import { getMetaAuthUrl } from "@/lib/meta.functions";
import { fmtMoneyRon } from "@/lib/format";

const TOTAL_STEPS = 5;

type LauncherState = {
  promotion_goal: PromotionGoal | null;
  niche: BusinessNiche;
  service: string;
  city: string;
  radius_km: number;
  daily_budget: number;
  custom_budget: string;
  creative_files: Array<{ name: string; url: string }>;
  lead_fields: LeadFieldConfig[];
  custom_question: string;
  business_name: string;
  privacy_policy_url: string;
  generated: GeneratedAdCopy | null;
  platform: "meta" | "tiktok" | null;
  ad_account_uuid: string;
  page_id: string;
};

export function CampaignLauncher() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [variation, setVariation] = useState(0);
  const [platformStatus, setPlatformStatus] = useState<{
    meta_connected: boolean;
    meta_accounts: Array<{ id: string; account_name: string | null }>;
    meta_pages: Array<{ id: string; name: string }>;
    suggested_platform: "meta" | "tiktok";
  } | null>(null);

  const runGenerate = useServerFn(generateLauncherCampaign);
  const runLaunch = useServerFn(launchLauncherCampaign);
  const fetchPlatform = useServerFn(getLauncherPlatformStatus);
  const fetchMetaAuth = useServerFn(getMetaAuthUrl);

  const [s, setS] = useState<LauncherState>({
    promotion_goal: null,
    niche: "beauty_makeup",
    service: "",
    city: "București",
    radius_km: 15,
    daily_budget: 50,
    custom_budget: "",
    creative_files: [],
    lead_fields: [...DEFAULT_LEAD_FIELDS],
    custom_question: "",
    business_name: "",
    privacy_policy_url: "https://adpilot.ro/privacy-policy",
    generated: null,
    platform: null,
    ad_account_uuid: "",
    page_id: "",
  });

  const update = <K extends keyof LauncherState>(k: K, v: LauncherState[K]) =>
    setS((p) => ({ ...p, [k]: v }));

  const loadPlatform = useCallback(async () => {
    try {
      const status = await fetchPlatform();
      setPlatformStatus(status);
      if (status.meta_accounts?.length && !s.ad_account_uuid) {
        update("ad_account_uuid", status.meta_accounts[0].id);
      }
      if (status.meta_pages?.length && !s.page_id) {
        update("page_id", status.meta_pages[0].id);
      }
      if (!s.platform) {
        update("platform", status.suggested_platform);
      }
    } catch {
      /* ignore */
    }
  }, [fetchPlatform, s.ad_account_uuid, s.page_id, s.platform]);

  useEffect(() => {
    if (step >= 5) loadPlatform();
  }, [step, loadPlatform]);

  const answers = useMemo((): LauncherSimpleAnswers | null => {
    if (!s.promotion_goal || !s.service.trim()) return null;
    return {
      promotion_goal: s.promotion_goal,
      niche: s.niche,
      service: s.service,
      city: s.city,
      radius_km: s.radius_km,
      daily_budget: s.daily_budget,
      business_name: s.business_name || undefined,
      privacy_policy_url: s.privacy_policy_url,
    };
  }, [s]);

  const titles = [
    { t: "Ce vrei să promovezi?", sub: "Alege obiectivul — noi ne ocupăm de restul." },
    { t: "De unde vrei clienți?", sub: "AI setează zona automat. Tu alegi doar orașul." },
    { t: "Cât vrei să investești?", sub: "Bugetul controlează câți oameni văd reclama. Poți opri oricând." },
    { t: "Adaugă poze sau video", sub: "Reclamele cu materiale reale merg mai bine — dar poți continua și fără." },
    { t: "AI pregătește reclama", sub: "Verifică previzualizarea și apasă Start." },
  ];

  const canNext = useMemo(() => {
    switch (step) {
      case 1:
        return !!s.promotion_goal && s.service.trim().length > 0;
      case 2:
        return s.city.trim().length > 0;
      case 3:
        return s.daily_budget >= 10;
      case 4:
        return true;
      case 5:
        return launched || (!!s.generated && s.privacy_policy_url.startsWith("http"));
      default:
        return false;
    }
  }, [step, s, launched]);

  function onNicheChange(niche: BusinessNiche) {
    const preset = BUSINESS_NICHES.find((n) => n.id === niche);
    update("niche", niche);
    update("lead_fields", suggestLeadFields(niche));
    if (preset?.services[0] && !s.service) update("service", preset.services[0]);
  }

  function toggleLeadField(key: LeadFieldConfig["key"], label: string) {
    const exists = s.lead_fields.find((f) => f.key === key);
    if (exists && (key === "full_name" || key === "phone")) return;
    if (exists) {
      update("lead_fields", s.lead_fields.filter((f) => f.key !== key));
    } else {
      update("lead_fields", [...s.lead_fields, { key, label, required: false }]);
    }
  }

  function onFilesSelected(files: FileList | null) {
    if (!files) return;
    const next = [...s.creative_files];
    for (const file of Array.from(files).slice(0, 5 - next.length)) {
      const url = URL.createObjectURL(file);
      next.push({ name: file.name, url });
    }
    update("creative_files", next);
  }

  async function runAI() {
    if (!answers) return;
    setSubmitting(true);
    try {
      const generated = await runGenerate({
        data: { answers, lead_fields: s.lead_fields, variation },
      });
      update("generated", generated);
      toast.success("Reclama ta e gata!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Generarea a eșuat");
    } finally {
      setSubmitting(false);
    }
  }

  async function connectMeta() {
    try {
      const { url } = await fetchMetaAuth();
      window.location.href = url;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Nu s-a putut conecta Meta");
    }
  }

  async function onLaunch() {
    if (!answers || !s.generated) return;
    setSubmitting(true);
    try {
      const platform = s.platform ?? platformStatus?.suggested_platform ?? "meta";
      if (platform === "meta" && !platformStatus?.meta_connected) {
        toast.error("Conectează Meta înainte de a porni reclama.");
        return;
      }
      await runLaunch({
        data: {
          answers,
          generated: s.generated,
          lead_fields: s.lead_fields,
          creative_urls: s.creative_files.map((f) => f.url),
          platform,
          ad_account_uuid: s.ad_account_uuid || undefined,
          page_id: s.page_id || undefined,
          privacy_policy_url: s.privacy_policy_url,
        },
      });
      setLaunched(true);
      toast.success("Reclama ta e pregătită!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Nu am putut crea reclama");
    } finally {
      setSubmitting(false);
    }
  }

  const onNext = async () => {
    if (step === 5) {
      if (launched) {
        navigate({ to: "/dashboard" });
        return;
      }
      if (!s.generated) {
        await runAI();
        return;
      }
      await onLaunch();
      return;
    }
    if (step === 4 && step < 5) {
      setStep(5);
      if (!s.generated && answers) await runAI();
      return;
    }
    setStep(step + 1);
  };

  const nextLabel = useMemo(() => {
    if (step === 5) {
      if (launched) return "Mergi la dashboard";
      if (!s.generated) return "Generează reclama";
      return "Pornește reclama mea";
    }
    if (step === 4) return "Continuă";
    return "Continuă";
  }, [step, launched, s.generated]);

  const idx = step - 1;

  return (
    <WizardShell
      step={step}
      total={TOTAL_STEPS}
      title={launched ? "Reclama ta e gata!" : titles[idx].t}
      subtitle={launched ? "Te anunțăm când vine primul lead." : titles[idx].sub}
      canBack={!launched}
      canNext={canNext}
      nextLabel={nextLabel}
      onBack={() => (step > 1 ? setStep(step - 1) : navigate({ to: "/dashboard" }))}
      onNext={onNext}
      isSubmitting={submitting}
    >
      {step === 1 && (
        <div className="space-y-6">
          <div className="space-y-2">
            {PROMOTION_GOALS.map((g) => (
              <ChoiceCard key={g.id} active={s.promotion_goal === g.id} onClick={() => update("promotion_goal", g.id)}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{g.icon}</span>
                  <div>
                    <div className="font-semibold">{g.title}</div>
                    <div className="text-sm text-muted-foreground">{g.subtitle}</div>
                  </div>
                </div>
              </ChoiceCard>
            ))}
          </div>
          <div>
            <FieldLabel>Tip de business</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {BUSINESS_NICHES.map((n) => (
                <Chip key={n.id} active={s.niche === n.id} onClick={() => onNicheChange(n.id)}>{n.title}</Chip>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Ce anume promovezi?</FieldLabel>
            <div className="flex flex-wrap gap-2 mb-3">
              {(BUSINESS_NICHES.find((n) => n.id === s.niche)?.services ?? []).map((svc) => (
                <Chip key={svc} active={s.service === svc} onClick={() => update("service", svc)}>{svc}</Chip>
              ))}
            </div>
            <Input
              value={s.service}
              onChange={(e) => update("service", e.target.value)}
              placeholder="ex: Machiaj de mireasă"
              className="h-12 rounded-xl"
            />
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5" /> AI se ocupă de setările tehnice pentru tine
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div>
            <FieldLabel><MapPin className="inline w-3.5 h-3.5 mr-1" />Oraș</FieldLabel>
            <Input value={s.city} onChange={(e) => update("city", e.target.value)} className="h-12 rounded-xl" placeholder="București" />
          </div>
          <div>
            <FieldLabel>Rază (km)</FieldLabel>
            <div className="flex gap-2">
              {[10, 15, 25].map((r) => (
                <Chip key={r} active={s.radius_km === r} onClick={() => update("radius_km", r)}>{r} km</Chip>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Clienții din {s.city} și împrejurimi ({s.radius_km} km) vor vedea reclama ta.
          </p>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {BUDGET_PRESETS_RON.map((b) => (
              <button
                key={b}
                onClick={() => update("daily_budget", b)}
                className={`px-5 py-3 rounded-2xl text-sm font-semibold press border-2 ${
                  s.daily_budget === b ? "border-foreground bg-secondary" : "border-border"
                }`}
              >
                {fmtMoneyRon(b)}/zi
              </button>
            ))}
          </div>
          <div>
            <FieldLabel>Sau buget personalizat (RON/zi)</FieldLabel>
            <Input
              type="number"
              min={10}
              value={s.custom_budget}
              onChange={(e) => {
                update("custom_budget", e.target.value);
                const n = parseInt(e.target.value, 10);
                if (n >= 10) update("daily_budget", n);
              }}
              className="h-12 rounded-xl"
              placeholder="75"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Bugetul selectat: <strong className="text-foreground">{fmtMoneyRon(s.daily_budget)}</strong> pe zi
          </p>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => onFilesSelected(e.target.files)} />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-10 rounded-2xl border-2 border-dashed border-border flex flex-col items-center gap-2 press"
          >
            <ImagePlus className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm font-medium">Încarcă 1–5 poze sau video</span>
          </button>
          {s.creative_files.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {s.creative_files.map((f, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-secondary">
                  <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                  <button
                    className="absolute top-1 right-1 p-1 bg-background/80 rounded-full"
                    onClick={() => update("creative_files", s.creative_files.filter((_, j) => j !== i))}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {!s.creative_files.length && (
            <p className="text-xs text-muted-foreground text-center">Poți continua fără poze — AI va genera textul reclamei.</p>
          )}
        </div>
      )}

      {step === 5 && !launched && (
        <div className="space-y-5">
          {!s.generated ? (
            <div className="text-center py-8">
              <Sparkles className="w-10 h-10 mx-auto text-foreground animate-pulse" />
              <p className="mt-3 text-sm text-muted-foreground">AI îți pregătește reclama…</p>
            </div>
          ) : (
            <>
              {platformStatus && !platformStatus.meta_connected && s.platform !== "tiktok" && (
                <div className="card-floating p-4 space-y-3">
                  <p className="text-sm">Conectează Meta pentru a publica reclama.</p>
                  <button onClick={connectMeta} className="w-full py-2.5 rounded-xl bg-meta text-meta-foreground text-sm font-medium press">
                    <Facebook className="inline w-4 h-4 mr-1" /> Conectează Meta
                  </button>
                </div>
              )}

              <div className="card-floating p-4 space-y-2 text-sm">
                <p className="font-medium">Previzualizare reclamă</p>
                <div className="rounded-xl bg-secondary p-4 whitespace-pre-wrap text-[13px] leading-relaxed">
                  {s.generated.primary_text}
                </div>
                <p className="text-muted-foreground"><strong className="text-foreground">Titlu:</strong> {s.generated.headline}</p>
                <p className="text-muted-foreground"><strong className="text-foreground">Cine o vede:</strong> {s.generated.audience_summary}</p>
                <p className="text-muted-foreground"><strong className="text-foreground">Cost:</strong> {fmtMoneyRon(s.daily_budget)}/zi</p>
                <p className="text-muted-foreground"><strong className="text-foreground">La submit:</strong> Clientul completează un formular scurt — primești notificare instant.</p>
              </div>

              <div>
                <FieldLabel>Ce informații vrei de la clienți?</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_LEAD_FIELDS.map((f) => (
                    <Chip key={f.key} active={s.lead_fields.some((x) => x.key === f.key)} onClick={() => {}}>
                      ☑ {f.label}
                    </Chip>
                  ))}
                  {OPTIONAL_LEAD_FIELDS.map((f) => (
                    <Chip key={f.key} active={s.lead_fields.some((x) => x.key === f.key)} onClick={() => toggleLeadField(f.key, f.label)}>
                      {s.lead_fields.some((x) => x.key === f.key) ? "☑" : "☐"} {f.label}
                    </Chip>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={s.custom_question}
                    onChange={(e) => update("custom_question", e.target.value)}
                    placeholder="Întrebare personalizată"
                    className="h-10 rounded-xl flex-1"
                  />
                  <button
                    className="px-4 rounded-xl border border-border text-sm press"
                    onClick={() => {
                      if (!s.custom_question.trim()) return;
                      update("lead_fields", [
                        ...s.lead_fields,
                        { key: "custom", label: s.custom_question, required: false, customQuestion: s.custom_question },
                      ]);
                      update("custom_question", "");
                    }}
                  >
                    Adaugă
                  </button>
                </div>
              </div>

              <div>
                <FieldLabel>Politica de confidențialitate (obligatoriu)</FieldLabel>
                <Input value={s.privacy_policy_url} onChange={(e) => update("privacy_policy_url", e.target.value)} className="h-12 rounded-xl" />
              </div>

              <button
                onClick={() => { setVariation((v) => v + 1); runAI(); }}
                disabled={submitting}
                className="flex items-center gap-2 text-sm text-muted-foreground underline"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Generează altă variantă
              </button>

              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5" /> Reclama se creează în mod pauzat — pentru siguranța ta
              </p>
            </>
          )}
        </div>
      )}

      {launched && (
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-secondary mx-auto flex items-center justify-center">
            <Check className="w-8 h-8" />
          </div>
          <p className="text-sm text-muted-foreground">
            Reclama ta e pregătită. Te anunțăm pe WhatsApp când vine primul lead.
          </p>
        </div>
      )}
    </WizardShell>
  );
}
