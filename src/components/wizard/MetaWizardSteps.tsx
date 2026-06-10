import { Facebook, Sparkles, Building2, Users, Phone, Globe, Check } from "lucide-react";
import { FieldLabel, ChoiceCard, Chip } from "@/components/wizard/WizardShell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { fmtMoney } from "@/lib/format";
import type { MetaGeneratedContent } from "@/lib/meta/types";

export type MetaWizardState = {
  business_name: string;
  service_product: string;
  location: string;
  target_audience: string;
  daily_budget: number;
  duration_days: number;
  phone: string;
  website: string;
  privacy_policy_url: string;
  ad_account_uuid: string;
  page_id: string;
  generated: MetaGeneratedContent | null;
  launch_active: boolean;
};

export type MetaAccountInfo = {
  id: string;
  ad_account_id: string;
  account_name: string | null;
};

export type MetaPageInfo = { id: string; name: string };

export function StepMetaPlatform({
  platform,
  onSelect,
}: {
  platform: "tiktok" | "meta" | null;
  onSelect: (p: "tiktok" | "meta") => void;
}) {
  return (
    <div className="space-y-3">
      <FieldLabel>Where do you want to advertise?</FieldLabel>
      <ChoiceCard active={platform === "tiktok"} onClick={() => onSelect("tiktok")}>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-tiktok text-tiktok-foreground flex items-center justify-center text-sm font-bold">
            TT
          </div>
          <div>
            <div className="font-semibold text-foreground">TikTok Ads</div>
            <div className="mt-0.5 text-sm text-muted-foreground">Your existing TikTok campaign flow.</div>
          </div>
        </div>
      </ChoiceCard>
      <ChoiceCard active={platform === "meta"} onClick={() => onSelect("meta")}>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-meta text-meta-foreground flex items-center justify-center">
            <Facebook className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-foreground">Meta Ads</div>
            <div className="mt-0.5 text-sm text-muted-foreground">Facebook & Instagram lead generation.</div>
          </div>
        </div>
      </ChoiceCard>
    </div>
  );
}

export function StepMetaConnect({
  connected,
  connecting,
  accounts,
  pages,
  selectedAccount,
  selectedPage,
  onConnect,
  onSelectAccount,
  onSelectPage,
}: {
  connected: boolean;
  connecting: boolean;
  accounts: MetaAccountInfo[];
  pages: MetaPageInfo[];
  selectedAccount: string;
  selectedPage: string;
  onConnect: () => void;
  onSelectAccount: (id: string) => void;
  onSelectPage: (id: string) => void;
}) {
  if (!connected) {
    return (
      <div className="space-y-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-meta/10 text-meta mx-auto flex items-center justify-center">
          <Facebook className="w-7 h-7" />
        </div>
        <p className="text-sm text-muted-foreground">
          Connect your Meta account to access ad accounts and Facebook Pages.
        </p>
        <button
          onClick={onConnect}
          disabled={connecting}
          className="press w-full py-3 rounded-xl bg-meta text-meta-foreground text-sm font-medium disabled:opacity-50"
        >
          {connecting ? "Redirecting…" : "Connect Meta Account"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <FieldLabel>Choose your ad account</FieldLabel>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ad accounts found. Check your Business Manager permissions.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <ChoiceCard key={a.id} active={selectedAccount === a.id} onClick={() => onSelectAccount(a.id)}>
                <div className="font-medium text-sm">{a.account_name ?? a.ad_account_id}</div>
              </ChoiceCard>
            ))}
          </div>
        )}
      </div>
      <div>
        <FieldLabel>Selected Facebook Page</FieldLabel>
        {pages.length === 0 ? (
          <div className="card-floating p-4 text-sm text-muted-foreground">
            To launch Meta Lead Ads, connect a Facebook Page linked to your Business Manager.
          </div>
        ) : (
          <div className="space-y-2">
            {pages.map((p) => (
              <ChoiceCard key={p.id} active={selectedPage === p.id} onClick={() => onSelectPage(p.id)}>
                <div className="font-medium text-sm">{p.name}</div>
              </ChoiceCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function StepMetaBusiness({
  s,
  update,
}: {
  s: MetaWizardState;
  update: <K extends keyof MetaWizardState>(k: K, v: MetaWizardState[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Tell us what you sell — we'll handle the rest.</p>
      <div>
        <FieldLabel><Building2 className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />Business name</FieldLabel>
        <Input value={s.business_name} onChange={(e) => update("business_name", e.target.value)} placeholder="Acme Services" className="h-12 rounded-xl" />
      </div>
      <div>
        <FieldLabel>Service / product</FieldLabel>
        <Input value={s.service_product} onChange={(e) => update("service_product", e.target.value)} placeholder="Home cleaning, coaching, etc." className="h-12 rounded-xl" />
      </div>
      <div>
        <FieldLabel>Location</FieldLabel>
        <Input value={s.location} onChange={(e) => update("location", e.target.value)} placeholder="United States, London, etc." className="h-12 rounded-xl" />
      </div>
      <div>
        <FieldLabel><Users className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />Target audience</FieldLabel>
        <Textarea value={s.target_audience} onChange={(e) => update("target_audience", e.target.value)} placeholder="Homeowners aged 30-55 interested in premium services" className="rounded-xl min-h-20" />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <FieldLabel>Daily budget</FieldLabel>
          <div className="font-serif text-2xl font-semibold tabular-nums">{fmtMoney(s.daily_budget)}</div>
        </div>
        <Slider min={5} max={500} step={5} value={[s.daily_budget]} onValueChange={(v) => update("daily_budget", v[0])} className="mt-3" />
      </div>
      <div>
        <FieldLabel>Campaign duration (days)</FieldLabel>
        <Input type="number" min={1} max={365} value={s.duration_days} onChange={(e) => update("duration_days", Number(e.target.value))} className="h-12 rounded-xl" />
      </div>
      <div>
        <FieldLabel><Phone className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />Phone number</FieldLabel>
        <Input value={s.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+1 555 000 0000" className="h-12 rounded-xl" />
      </div>
      <div>
        <FieldLabel><Globe className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />Website (optional)</FieldLabel>
        <Input value={s.website} onChange={(e) => update("website", e.target.value)} placeholder="https://yourbrand.com" className="h-12 rounded-xl" />
      </div>
    </div>
  );
}

export function StepMetaAI({
  generating,
  generated,
  onGenerate,
  onUpdate,
}: {
  generating: boolean;
  generated: MetaGeneratedContent | null;
  onGenerate: () => void;
  onUpdate: (g: MetaGeneratedContent) => void;
}) {
  if (!generated) {
    return (
      <div className="text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-secondary mx-auto flex items-center justify-center">
          <Sparkles className="w-7 h-7 text-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">AI prepares your campaign — ad copy, lead form, and audience.</p>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="press w-full py-3 rounded-xl bg-foreground text-background text-sm font-medium disabled:opacity-50"
        >
          {generating ? "Preparing…" : "Generate my campaign"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Campaign name</FieldLabel>
        <Input value={generated.campaign_name} onChange={(e) => onUpdate({ ...generated, campaign_name: e.target.value })} className="h-12 rounded-xl" />
      </div>
      <div>
        <FieldLabel>Primary text</FieldLabel>
        <Textarea value={generated.primary_text} onChange={(e) => onUpdate({ ...generated, primary_text: e.target.value })} className="rounded-xl min-h-20" />
      </div>
      <div>
        <FieldLabel>Headline</FieldLabel>
        <Input value={generated.headline} onChange={(e) => onUpdate({ ...generated, headline: e.target.value })} className="h-12 rounded-xl" />
      </div>
      <div>
        <FieldLabel>Description</FieldLabel>
        <Textarea value={generated.description} onChange={(e) => onUpdate({ ...generated, description: e.target.value })} className="rounded-xl min-h-16" />
      </div>
      <div>
        <FieldLabel>Call to action</FieldLabel>
        <div className="flex gap-2">
          <Chip active={generated.call_to_action === "SIGN_UP"} onClick={() => onUpdate({ ...generated, call_to_action: "SIGN_UP" })}>Sign Up</Chip>
          <Chip active={generated.call_to_action === "LEARN_MORE"} onClick={() => onUpdate({ ...generated, call_to_action: "LEARN_MORE" })}>Learn More</Chip>
        </div>
      </div>
      <div>
        <FieldLabel>Lead form questions</FieldLabel>
        <p className="text-sm text-muted-foreground">Name, email, and phone will be collected.</p>
      </div>
      <div>
        <FieldLabel>Audience suggestion</FieldLabel>
        <p className="text-sm text-muted-foreground">
          {generated.targeting_suggestion.countries.join(", ")} · Ages {generated.targeting_suggestion.age_min}–{generated.targeting_suggestion.age_max}
        </p>
      </div>
      <button onClick={onGenerate} disabled={generating} className="text-sm text-muted-foreground underline">
        Regenerate
      </button>
    </div>
  );
}

export function StepMetaReview({
  s,
  accountName,
  pageName,
  onPrivacyChange,
}: {
  s: MetaWizardState;
  accountName: string;
  pageName: string;
  onPrivacyChange: (url: string) => void;
}) {
  const g = s.generated;
  return (
    <div className="space-y-3">
      <ReviewRow label="Budget" value={`${fmtMoney(s.daily_budget)} / day · ${s.duration_days} days`} />
      <ReviewRow label="Audience" value={s.target_audience} />
      <ReviewRow label="Ad account" value={accountName} />
      <ReviewRow label="Facebook Page" value={pageName} />
      {g && (
        <>
          <ReviewRow label="Campaign" value={g.campaign_name} />
          <ReviewRow label="Headline" value={g.headline} />
          <ReviewRow label="Primary text" value={g.primary_text} />
          <ReviewRow label="CTA" value={g.call_to_action === "SIGN_UP" ? "Sign Up" : "Learn More"} />
        </>
      )}
      <div className="pt-3">
        <FieldLabel>Privacy policy URL (required)</FieldLabel>
        <Input value={s.privacy_policy_url} onChange={(e) => onPrivacyChange(e.target.value)} placeholder="https://yourbrand.com/privacy" className="h-12 rounded-xl" />
      </div>
      <div className="mt-4 card-floating p-4 flex items-start gap-3 text-sm">
        <Check className="w-4 h-4 mt-0.5 text-foreground shrink-0" />
        <div className="text-muted-foreground">
          Your campaign will be created in <strong className="text-foreground">paused</strong> mode for safety. You can activate it in Meta Ads Manager when ready.
        </div>
      </div>
    </div>
  );
}

export function StepMetaLaunchSuccess({ campaignName }: { campaignName: string }) {
  return (
    <div className="text-center space-y-4 py-6">
      <div className="w-16 h-16 rounded-full bg-secondary mx-auto flex items-center justify-center">
        <Check className="w-8 h-8 text-foreground" />
      </div>
      <h2 className="font-serif text-2xl font-semibold">Your campaign is ready</h2>
      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">{campaignName}</strong> has been created on Meta. It's paused — review it in Reports before going live.
      </p>
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
