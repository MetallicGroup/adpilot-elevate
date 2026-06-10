import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Target, TrendingUp, Calendar, MapPin, Sparkles, Image as ImageIcon, FileText, Check, Music2, Facebook } from "lucide-react";
import { WizardShell, FieldLabel, ChoiceCard, Chip } from "@/components/wizard/WizardShell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { saveCampaign } from "@/lib/campaigns.functions";
import { fmtMoney } from "@/lib/format";

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
  lf_privacy_url: string;
};

const LOCATIONS = ["United States", "United Kingdom", "Canada", "Australia", "Germany", "France", "Brazil", "Mexico", "Japan", "India"];
const AGES = ["13-17", "18-24", "25-34", "35-44", "45-54", "55+"];
const GENDERS = ["All", "Female", "Male"];
const INTERESTS = ["Beauty", "Fashion", "Fitness", "Food", "Gaming", "Tech", "Travel", "Finance", "Education", "Home", "Pets", "Auto"];
const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Japanese"];
const CTAS = ["Learn More", "Sign Up", "Shop Now", "Download", "Apply Now", "Book Now"];
const LEAD_FIELDS = ["Name", "Email", "Phone", "City", "Zip Code", "Company", "Job Title"];

function CreateWizard() {
  const navigate = useNavigate();
  const submit = useServerFn(saveCampaign);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [s, setS] = useState<State>({
    platform: "tiktok",
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
    lf_fields: ["Name", "Email"],
    lf_privacy_url: "",
  });

  const update = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));
  const toggle = <K extends keyof State>(k: K, v: string) => {
    const arr = s[k] as unknown as string[];
    update(k, (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]) as State[K]);
  };

  const total = s.objective === "LEAD_GENERATION" ? 6 : 5;

  const canNext = useMemo(() => {
    switch (step) {
      case 1: return s.name.trim().length > 0 && !!s.objective;
      case 2: return s.budget >= 5 && !!s.start_date;
      case 3: return s.locations.length > 0 && s.age_groups.length > 0;
      case 4: return s.headline.trim().length > 0 && s.landing_url.trim().length > 0;
      case 5: return s.objective === "CONVERSIONS" ? true : (s.lf_title.trim().length > 0 && s.lf_fields.length > 0);
      case 6: return true;
      default: return false;
    }
  }, [step, s]);

  const titles = [
    { t: "What's your goal?", sub: "We'll optimize delivery around this objective." },
    { t: "Set your budget", sub: "Start small — you can scale anytime." },
    { t: "Who should see this?", sub: "Refine your audience by location, age and interests." },
    { t: "Build your creative", sub: "Make something that stops the scroll." },
    { t: s.objective === "LEAD_GENERATION" ? "Design your lead form" : "Review your campaign", sub: s.objective === "LEAD_GENERATION" ? "Capture the info you need — keep it short." : "Double-check everything before you launch." },
    { t: "Review your campaign", sub: "Double-check everything before you launch." },
  ];

  const onNext = async () => {
    if (step < total) { setStep(step + 1); return; }
    setSubmitting(true);
    try {
      await submit({
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
            privacy_url: s.lf_privacy_url.trim(),
          } : null,
          status: "draft",
        },
      });
      toast.success("Campaign saved as draft");
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save campaign");
    } finally {
      setSubmitting(false);
    }
  };

  const onBack = () => (step > 1 ? setStep(step - 1) : navigate({ to: "/dashboard" }));

  const idx = step - 1;
  const isLast = step === total;

  return (
    <WizardShell
      step={step}
      total={total}
      title={titles[idx].t}
      subtitle={titles[idx].sub}
      canBack={true}
      canNext={canNext}
      nextLabel={isLast ? "Save campaign" : "Continue"}
      onBack={onBack}
      onNext={onNext}
      isSubmitting={submitting}
    >
      {step === 1 && <StepGoal s={s} update={update} />}
      {step === 2 && <StepBudget s={s} update={update} />}
      {step === 3 && <StepAudience s={s} toggle={toggle} />}
      {step === 4 && <StepCreative s={s} update={update} />}
      {step === 5 && s.objective === "LEAD_GENERATION" && <StepLeadForm s={s} update={update} toggle={toggle} />}
      {((step === 5 && s.objective === "CONVERSIONS") || step === 6) && <StepReview s={s} />}
    </WizardShell>
  );
}

function StepGoal({ s, update }: { s: State; update: <K extends keyof State>(k: K, v: State[K]) => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <FieldLabel>Platform</FieldLabel>
        <div className="grid grid-cols-2 gap-3">
          <ChoiceCard active={s.platform === "tiktok"} onClick={() => update("platform", "tiktok")}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center">
                <Music2 className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-foreground">TikTok Ads</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Short-form video, Gen Z reach</div>
              </div>
            </div>
          </ChoiceCard>
          <ChoiceCard active={s.platform === "meta"} onClick={() => update("platform", "meta")}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center">
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
        <FieldLabel>Campaign name</FieldLabel>
        <Input
          value={s.name}
          onChange={(e) => update("name", e.target.value.slice(0, 120))}
          placeholder="Summer launch — leads"
          className="h-12 rounded-xl"
        />
      </div>
      <div className="space-y-3">
        <FieldLabel>Objective</FieldLabel>
        <ChoiceCard active={s.objective === "LEAD_GENERATION"} onClick={() => update("objective", "LEAD_GENERATION")}>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Lead generation</div>
              <div className="mt-0.5 text-sm text-muted-foreground">Collect contact info with an in-app form.</div>
            </div>
          </div>
        </ChoiceCard>
        <ChoiceCard active={s.objective === "CONVERSIONS"} onClick={() => update("objective", "CONVERSIONS")}>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Conversions</div>
              <div className="mt-0.5 text-sm text-muted-foreground">Drive purchases or sign-ups on your site.</div>
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
        <FieldLabel>Budget type</FieldLabel>
        <div className="flex gap-2">
          <Chip active={s.budget_mode === "BUDGET_MODE_DAY"} onClick={() => update("budget_mode", "BUDGET_MODE_DAY")}>Daily</Chip>
          <Chip active={s.budget_mode === "BUDGET_MODE_TOTAL"} onClick={() => update("budget_mode", "BUDGET_MODE_TOTAL")}>Lifetime</Chip>
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <FieldLabel>{s.budget_mode === "BUDGET_MODE_DAY" ? "Daily budget" : "Lifetime budget"}</FieldLabel>
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
          <FieldLabel><Calendar className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />Start</FieldLabel>
          <Input type="date" value={s.start_date} onChange={(e) => update("start_date", e.target.value)} className="h-12 rounded-xl" />
        </div>
        <div>
          <FieldLabel><Calendar className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />End (optional)</FieldLabel>
          <Input type="date" value={s.end_date} onChange={(e) => update("end_date", e.target.value)} className="h-12 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function StepAudience({ s, toggle }: { s: State; toggle: <K extends keyof State>(k: K, v: string) => void }) {
  return (
    <div className="space-y-7">
      <Section icon={<MapPin className="w-4 h-4" />} label="Locations">
        <div className="flex flex-wrap gap-2">
          {LOCATIONS.map((l) => (
            <Chip key={l} active={s.locations.includes(l)} onClick={() => toggle("locations", l)}>{l}</Chip>
          ))}
        </div>
      </Section>
      <Section label="Age">
        <div className="flex flex-wrap gap-2">
          {AGES.map((a) => (
            <Chip key={a} active={s.age_groups.includes(a)} onClick={() => toggle("age_groups", a)}>{a}</Chip>
          ))}
        </div>
      </Section>
      <Section label="Gender">
        <div className="flex flex-wrap gap-2">
          {GENDERS.map((g) => (
            <Chip key={g} active={s.genders.includes(g)} onClick={() => toggle("genders", g)}>{g}</Chip>
          ))}
        </div>
      </Section>
      <Section icon={<Sparkles className="w-4 h-4" />} label="Interests">
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => (
            <Chip key={i} active={s.interests.includes(i)} onClick={() => toggle("interests", i)}>{i}</Chip>
          ))}
        </div>
      </Section>
      <Section label="Languages">
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <Chip key={l} active={s.languages.includes(l)} onClick={() => toggle("languages", l)}>{l}</Chip>
          ))}
        </div>
      </Section>
    </div>
  );
}

function StepCreative({ s, update }: { s: State; update: <K extends keyof State>(k: K, v: State[K]) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <FieldLabel><ImageIcon className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />Video / image URL</FieldLabel>
        <Input value={s.media_url} onChange={(e) => update("media_url", e.target.value)} placeholder="https://…" className="h-12 rounded-xl" />
        <p className="mt-1.5 text-[11px] text-muted-foreground">Paste a hosted video URL. Upload coming soon.</p>
      </div>
      <div>
        <FieldLabel>Headline</FieldLabel>
        <Input value={s.headline} onChange={(e) => update("headline", e.target.value.slice(0, 80))} placeholder="The smarter way to launch" className="h-12 rounded-xl" />
        <p className="mt-1.5 text-[11px] text-muted-foreground">{s.headline.length}/80</p>
      </div>
      <div>
        <FieldLabel>Description</FieldLabel>
        <Textarea value={s.description} onChange={(e) => update("description", e.target.value.slice(0, 280))} placeholder="Tell people why they should care." className="rounded-xl min-h-24" />
        <p className="mt-1.5 text-[11px] text-muted-foreground">{s.description.length}/280</p>
      </div>
      <div>
        <FieldLabel>Call to action</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {CTAS.map((c) => (
            <Chip key={c} active={s.cta === c} onClick={() => update("cta", c)}>{c}</Chip>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Landing URL</FieldLabel>
        <Input value={s.landing_url} onChange={(e) => update("landing_url", e.target.value)} placeholder="https://yourbrand.com/offer" className="h-12 rounded-xl" />
      </div>
    </div>
  );
}

function StepLeadForm({ s, update, toggle }: { s: State; update: <K extends keyof State>(k: K, v: State[K]) => void; toggle: <K extends keyof State>(k: K, v: string) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <FieldLabel><FileText className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />Form title</FieldLabel>
        <Input value={s.lf_title} onChange={(e) => update("lf_title", e.target.value.slice(0, 120))} placeholder="Get early access" className="h-12 rounded-xl" />
      </div>
      <div>
        <FieldLabel>Intro message</FieldLabel>
        <Textarea value={s.lf_intro} onChange={(e) => update("lf_intro", e.target.value.slice(0, 500))} placeholder="Tell us a bit about yourself — we'll reach out within 24 hours." className="rounded-xl min-h-20" />
      </div>
      <div>
        <FieldLabel>Fields to collect</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {LEAD_FIELDS.map((f) => (
            <Chip key={f} active={s.lf_fields.includes(f)} onClick={() => toggle("lf_fields", f)}>{f}</Chip>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Privacy policy URL</FieldLabel>
        <Input value={s.lf_privacy_url} onChange={(e) => update("lf_privacy_url", e.target.value)} placeholder="https://yourbrand.com/privacy" className="h-12 rounded-xl" />
      </div>
    </div>
  );
}

function StepReview({ s }: { s: State }) {
  return (
    <div className="space-y-3">
      <ReviewRow label="Platform" value={s.platform === "tiktok" ? "TikTok Ads" : "Meta Ads (Facebook & Instagram)"} />
      <ReviewRow label="Name" value={s.name} />
      <ReviewRow label="Objective" value={s.objective === "LEAD_GENERATION" ? "Lead generation" : "Conversions"} />
      <ReviewRow label="Budget" value={`${fmtMoney(s.budget)} ${s.budget_mode === "BUDGET_MODE_DAY" ? "/ day" : "lifetime"}`} />
      <ReviewRow label="Schedule" value={`${s.start_date}${s.end_date ? ` → ${s.end_date}` : " · ongoing"}`} />
      <ReviewRow label="Locations" value={s.locations.join(", ") || "—"} />
      <ReviewRow label="Age" value={s.age_groups.join(", ") || "—"} />
      <ReviewRow label="Gender" value={s.genders.join(", ") || "—"} />
      <ReviewRow label="Interests" value={s.interests.length ? s.interests.join(", ") : "Any"} />
      <ReviewRow label="Languages" value={s.languages.join(", ") || "—"} />
      <ReviewRow label="Headline" value={s.headline} />
      <ReviewRow label="CTA" value={s.cta} />
      <ReviewRow label="Landing URL" value={s.landing_url} />
      {s.objective === "LEAD_GENERATION" && (
        <>
          <ReviewRow label="Form" value={s.lf_title} />
          <ReviewRow label="Fields" value={s.lf_fields.join(", ")} />
        </>
      )}
      <div className="mt-6 card-floating p-4 flex items-start gap-3 text-sm">
        <Check className="w-4 h-4 mt-0.5 text-foreground" />
        <div className="text-muted-foreground">
          Saved as a draft to your workspace. Connect {s.platform === "tiktok" ? "TikTok" : "Meta"} in Settings to publish live.
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

function Section({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <FieldLabel>{icon}<span className={icon ? "ml-1.5" : ""}>{label}</span></FieldLabel>
      {children}
    </div>
  );
}