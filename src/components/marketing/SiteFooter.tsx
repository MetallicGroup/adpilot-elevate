import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/adpilot-logo.png.asset.json";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/40 mt-24">
      <div className="max-w-6xl mx-auto w-full px-6 py-16 grid gap-10 md:grid-cols-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
              <img src={logoAsset.url} alt="" className="h-6 w-6 object-contain" />
            </div>
            <span className="font-semibold tracking-tight">AdPilot</span>
          </div>
          <p className="mt-4 text-sm text-muted-foreground max-w-xs">
            Platforma AI care lansează, gestionează și optimizează reclame Facebook & Instagram — fără agenție, fără bătăi de cap.
          </p>
        </div>
        <FooterCol title="Companie" links={[
          { to: "/about", label: "Despre noi" },
          { to: "/contact", label: "Contact" },
          { to: "/pricing", label: "Prețuri" },
        ]} />
        <FooterCol title="Legal" links={[
          { to: "/privacy-policy", label: "Politica de confidențialitate" },
          { to: "/terms-of-service", label: "Termeni și condiții" },
          { to: "/cookie-policy", label: "Politica cookies" },
          { to: "/gdpr", label: "Conformitate GDPR" },
        ]} />
        <FooterCol title="Produs" links={[
          { to: "/features", label: "Funcționalități" },
          { to: "/integrations", label: "Integrări" },
          { to: "/security", label: "Securitate" },
        ]} />
        <FooterCol title="Suport" links={[
          { to: "/help-center", label: "Centru de ajutor" },
          { to: "/documentation", label: "Documentație" },
          { to: "/contact", label: "Contact" },
        ]} />
      </div>
      <div className="border-t border-border">
        <div className="max-w-6xl mx-auto w-full px-6 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} AdPilot. Toate drepturile rezervate.</p>
          <p>Construit în România 🇷🇴 · Neafiliat cu Meta Platforms, Inc.</p>
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