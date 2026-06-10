import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/adpilot-logo.png.asset.json";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/30 mt-24">
      <div className="max-w-6xl mx-auto w-full px-6 py-16 grid gap-10 md:grid-cols-5">
        <div>
          <div className="flex items-center gap-2">
            <img src={logoAsset.url} alt="AdPilot" className="h-9 w-9 object-contain" />
            <span className="font-semibold tracking-tight">AdPilot</span>
          </div>
          <p className="mt-4 text-sm text-muted-foreground max-w-xs">
            The AI platform to launch, manage, and optimize TikTok ads — without an agency.
          </p>
        </div>
        <FooterCol title="Company" links={[
          { to: "/about", label: "About" },
          { to: "/contact", label: "Contact" },
          { to: "/pricing", label: "Pricing" },
        ]} />
        <FooterCol title="Legal" links={[
          { to: "/privacy-policy", label: "Privacy Policy" },
          { to: "/terms-of-service", label: "Terms of Service" },
          { to: "/cookie-policy", label: "Cookie Policy" },
          { to: "/gdpr", label: "GDPR Compliance" },
        ]} />
        <FooterCol title="Product" links={[
          { to: "/features", label: "Features" },
          { to: "/integrations", label: "Integrations" },
          { to: "/security", label: "Security" },
        ]} />
        <FooterCol title="Support" links={[
          { to: "/help-center", label: "Help Center" },
          { to: "/documentation", label: "Documentation" },
          { to: "/contact", label: "Contact" },
        ]} />
      </div>
      <div className="border-t border-border">
        <div className="max-w-6xl mx-auto w-full px-6 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} AdPilot. All rights reserved.</p>
          <p>Made for ad creators. Not affiliated with TikTok Inc.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-4">{title}</h4>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}