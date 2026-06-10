import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { Check, Megaphone, Bot, Inbox, LineChart, MessageCircle, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({ meta: [
    { title: "Features — AdPilot" },
    { name: "description", content: "TikTok ad management, AI campaign builder, lead generation, analytics and WhatsApp AI assistant — all in one platform." },
  ] }),
  component: FeaturesPage,
});

const features = [
  { icon: Megaphone, title: "TikTok Ads Management", items: ["Create campaigns end-to-end", "Manage campaigns in bulk", "Daily & lifetime budget control", "Real-time delivery monitoring"] },
  { icon: Bot, title: "AI Campaign Builder", items: ["AI audience suggestions", "AI ad copy generation", "Auto campaign structure", "Smart optimization tips"] },
  { icon: Inbox, title: "Lead Generation", items: ["Native TikTok lead forms", "Instant lead notifications", "CRM integration ready", "WhatsApp alerts"] },
  { icon: LineChart, title: "Analytics", items: ["Spend & CTR tracking", "CPL & ROAS dashboards", "Conversion tracking", "Daily performance reports"] },
  { icon: MessageCircle, title: "WhatsApp AI Assistant", items: ['"Start the campaign"', '"Increase budget by 20%"', '"How many leads today?"', "24/7 conversational control"] },
  { icon: ShieldCheck, title: "Security First", items: ["TikTok OAuth", "GDPR compliant", "Encrypted storage", "Advertiser owns the account"] },
];

function FeaturesPage() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="Features" title="Everything you need to run TikTok ads." subtitle="From campaign creation to lead delivery, AdPilot covers the full lifecycle of a TikTok advertising campaign." />
      <section className="px-6 pb-20 max-w-6xl mx-auto w-full grid gap-5 md:grid-cols-2">
        {features.map((f) => (
          <div key={f.title} className="card-floating p-7">
            <f.icon className="w-5 h-5 text-tiktok" />
            <h3 className="mt-4 font-semibold text-lg">{f.title}</h3>
            <ul className="mt-4 space-y-2">
              {f.items.map((i) => (
                <li key={i} className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-success mt-0.5 shrink-0" />{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <section className="px-6 py-16 max-w-3xl mx-auto w-full text-center">
        <Link to="/auth" className="press inline-flex items-center px-8 py-4 bg-foreground text-background rounded-xl font-medium">Start Free Trial</Link>
      </section>
    </MarketingLayout>
  );
}