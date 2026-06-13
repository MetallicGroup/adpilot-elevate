import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import logoAsset from "@/assets/adpilot-logo.png.asset.json";

const links = [
  { to: "/features", label: "Funcționalități" },
  { to: "/pricing", label: "Prețuri" },
  { to: "/about", label: "Despre" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${scrolled ? "bg-background/80 backdrop-blur-xl backdrop-saturate-150 border-b border-border/60" : "bg-transparent"}`}>
      <div className="max-w-6xl mx-auto w-full px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
            <img src={logoAsset.url} alt="" className="h-6 w-6 object-contain" />
          </div>
          <span className="font-semibold tracking-tight text-foreground">AdPilot</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Autentificare</Link>
          <Link to="/auth" className="press btn-primary text-sm px-4 py-2 rounded-lg font-medium">
            Începe gratuit
          </Link>
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl">
          <div className="px-6 py-4 flex flex-col gap-3">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="text-sm py-1">
                {l.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-border flex flex-col gap-2">
              <Link to="/auth" onClick={() => setOpen(false)} className="text-sm py-1">Autentificare</Link>
              <Link to="/auth" onClick={() => setOpen(false)} className="press btn-primary text-sm px-4 py-2.5 rounded-lg text-center font-medium">
                Începe gratuit
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}