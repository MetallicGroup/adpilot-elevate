import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout, PageHero } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/documentation")({
  head: () => ({ meta: [
    { title: "Documentation — AdPilot" },
    { name: "description", content: "Product documentation: getting started, campaign creation, integrations, API and more." },
  ] }),
  component: Documentation,
});

const sections = [
  {
    title: "1. Getting started",
    items: [
      { id: "create-account", h: "Create your account", body: "Sign up at adpilot.ro/auth with your email and password, or continue with Google. After confirming your email, you'll land on the dashboard." },
      { id: "connect-tiktok", h: "Connect your TikTok ad account", body: "From Settings → Connections, click Connect TikTok. You'll be redirected to TikTok's secure OAuth screen where you choose which Business Center and which ad accounts to share with AdPilot. You can revoke access at any time from TikTok Business Center." },
      { id: "first-campaign", h: "Launch your first campaign", body: "Click Create Campaign from the dashboard. Follow the 6-step wizard: goal, budget, audience, creative, lead form (if applicable), and review. AdPilot's AI suggests audiences and ad copy at each step." },
    ],
  },
  {
    title: "2. Campaigns",
    items: [
      { id: "objectives", h: "Supported campaign objectives", body: "AdPilot currently supports Lead Generation and Website Conversions. Both objectives include AI-generated audience suggestions and creative optimization." },
      { id: "budget", h: "Budget control", body: "Choose daily or lifetime budget. You can change budgets in real time from the Campaign detail screen; changes propagate to TikTok within seconds." },
      { id: "monitoring", h: "Performance monitoring", body: "The dashboard refreshes spend, CTR, CPL and ROAS every 15 minutes. Open a campaign to see hourly delivery curves and audience breakdown." },
    ],
  },
  {
    title: "3. Leads & CRM",
    items: [
      { id: "lead-inbox", h: "Lead Inbox", body: "All leads collected from TikTok lead forms appear in the Lead Inbox in real time. Each lead includes contact details, the form fields, the source campaign and timestamp." },
      { id: "whatsapp-alerts", h: "WhatsApp alerts", body: "Enable WhatsApp alerts under Settings → Notifications. You'll receive an instant message for every new lead. Reply with commands like 'mark as contacted' or 'export today's leads'." },
      { id: "crm-export", h: "CRM export", body: "Connect your CRM (HubSpot, Pipedrive, Notion) under Settings → Integrations. New leads sync automatically." },
    ],
  },
  {
    title: "4. Account & billing",
    items: [
      { id: "plans", h: "Plans and billing", body: "Manage your subscription from Settings → Billing. You can upgrade or downgrade at any time. Invoices are emailed automatically and stored under Billing → History." },
      { id: "team", h: "Team members", body: "Pro plan supports unlimited team members. Invite by email from Settings → Team. Roles: Admin, Operator, Viewer." },
      { id: "delete-account", h: "Delete your account", body: "You can delete your account at any time from Settings → Account → Danger Zone. All personal data is permanently erased within 30 days. You can also request deletion by emailing support@adpilot.ro." },
    ],
  },
  {
    title: "5. Security",
    items: [
      { id: "oauth", h: "OAuth and tokens", body: "AdPilot uses TikTok's official OAuth 2.0 flow. We store access and refresh tokens encrypted at rest using AES-256. We never see or store your TikTok password." },
      { id: "gdpr", h: "GDPR & data residency", body: "All personal data is processed in the EU. AdPilot is GDPR compliant. See the GDPR page for the full list of rights and how to exercise them." },
    ],
  },
];

function Documentation() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="Documentation" title="Everything you need to ship." subtitle="Product documentation, walkthroughs and best practices." />
      <section className="px-6 pb-24 max-w-5xl mx-auto w-full grid gap-10 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-24 self-start">
          <nav className="space-y-1 text-sm">
            {sections.map((s) => (
              <a key={s.title} href={`#${slug(s.title)}`} className="block py-1.5 text-muted-foreground hover:text-foreground transition-colors">
                {s.title}
              </a>
            ))}
          </nav>
        </aside>
        <div className="space-y-14">
          {sections.map((s) => (
            <section key={s.title} id={slug(s.title)}>
              <h2 className="font-serif text-3xl font-semibold tracking-tight">{s.title}</h2>
              <div className="mt-6 space-y-5">
                {s.items.map((it) => (
                  <div key={it.id} id={it.id} className="card-floating p-6">
                    <h3 className="font-semibold">{it.h}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{it.body}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
          <div className="card-floating-lg p-7">
            <h3 className="font-semibold">Can't find what you need?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Try the <Link to="/help-center" className="underline">Help Center</Link> or email{" "}
              <a href="mailto:support@adpilot.ro" className="underline">support@adpilot.ro</a>.
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}