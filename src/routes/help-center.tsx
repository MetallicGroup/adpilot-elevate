import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";
import { Rocket, CreditCard, ShieldCheck, Megaphone, Inbox, MessageCircle, Settings, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/help-center")({
  head: () => ({ meta: [
    { title: "Help Center — AdPilot" },
    { name: "description", content: "Guides, walkthroughs and answers to help you get the most out of AdPilot." },
  ] }),
  component: HelpCenter,
});

const categories = [
  { icon: Rocket, title: "Getting started", body: "Create your account, connect TikTok, launch your first campaign." },
  { icon: Megaphone, title: "Campaigns", body: "Building, editing, pausing and optimizing TikTok campaigns." },
  { icon: Inbox, title: "Leads & CRM", body: "Receiving leads, exporting them, and connecting your CRM." },
  { icon: MessageCircle, title: "WhatsApp Assistant", body: "Setting up WhatsApp and using AI commands." },
  { icon: CreditCard, title: "Billing", body: "Subscriptions, invoices, plan changes, refunds." },
  { icon: ShieldCheck, title: "Security & Privacy", body: "OAuth, GDPR, data deletion requests." },
  { icon: Settings, title: "Account settings", body: "Profile, team members, notification preferences." },
  { icon: HelpCircle, title: "Troubleshooting", body: "Common errors and how to resolve them." },
];

function HelpCenter() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="Help Center" title="How can we help?" subtitle="Browse guides by topic or write to support@adpilot.ro and our team will get back to you within one business day." />
      <section className="px-6 pb-12 max-w-5xl mx-auto w-full grid gap-4 md:grid-cols-2">
        {categories.map((c) => (
          <div key={c.title} className="card-floating p-6 flex items-start gap-4">
            <c.icon className="w-5 h-5 text-tiktok shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
            </div>
          </div>
        ))}
      </section>
      <section className="px-6 pb-24 max-w-3xl mx-auto w-full text-center">
        <div className="card-floating-lg p-8">
          <h3 className="font-semibold text-lg">Still need help?</h3>
          <p className="mt-2 text-sm text-muted-foreground">Our team is one email away.</p>
          <a href="mailto:support@adpilot.ro" className="press mt-6 inline-flex items-center px-6 py-3 rounded-lg bg-foreground text-background text-sm font-medium">
            Email support@adpilot.ro
          </a>
          <p className="mt-4 text-xs text-muted-foreground">Looking for product docs? <Link to="/documentation" className="underline">Visit the documentation</Link>.</p>
        </div>
      </section>
    </MarketingLayout>
  );
}