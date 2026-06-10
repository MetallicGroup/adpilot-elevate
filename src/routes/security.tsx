import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { Check, ShieldCheck, Lock, Globe, Users } from "lucide-react";

export const Route = createFileRoute("/security")({
  head: () => ({ meta: [
    { title: "Security & Privacy — AdPilot" },
    { name: "description", content: "OAuth authentication, GDPR compliance, encrypted storage and full ad account ownership for advertisers." },
  ] }),
  component: SecurityPage,
});

const pillars = [
  { icon: ShieldCheck, title: "OAuth Authentication", body: "We connect to TikTok using the official OAuth 2.0 flow. We never see or store your TikTok password." },
  { icon: Lock, title: "Encrypted Storage", body: "All access tokens and personal data are encrypted at rest using industry-standard AES-256." },
  { icon: Globe, title: "GDPR Compliant", body: "Built in the EU, AdPilot follows GDPR principles: lawful basis, data minimization, and the right to delete." },
  { icon: Users, title: "You Own Your Ad Account", body: "The TikTok Business Account always remains in the advertiser's name. We never take ownership of accounts or campaigns." },
];

function SecurityPage() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="Security & Privacy" title="Your data. Your ad account. Your control." subtitle="Security is not a feature — it's the foundation of AdPilot. Here is how we protect your account and your customers' data." />
      <section className="px-6 pb-12 max-w-5xl mx-auto w-full grid gap-5 md:grid-cols-2">
        {pillars.map((p) => (
          <div key={p.title} className="card-floating p-7">
            <p.icon className="w-6 h-6 text-tiktok" />
            <h3 className="mt-4 font-semibold">{p.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.body}</p>
          </div>
        ))}
      </section>
      <section className="px-6 pb-20 max-w-3xl mx-auto w-full">
        <div className="card-floating-lg p-8">
          <h3 className="font-semibold">Our commitments</h3>
          <ul className="mt-5 space-y-3">
            {[
              "We never sell or share your data with third parties.",
              "We never run ads or campaigns without explicit user approval.",
              "You can revoke AdPilot's access to your TikTok account at any time.",
              "You can request full data export or deletion via privacy@adpilot.ro.",
              "Personal data is processed only as described in our Privacy Policy.",
            ].map((i) => (
              <li key={i} className="flex items-start gap-3 text-sm"><Check className="w-4 h-4 text-success mt-0.5 shrink-0" />{i}</li>
            ))}
          </ul>
        </div>
      </section>
    </MarketingLayout>
  );
}