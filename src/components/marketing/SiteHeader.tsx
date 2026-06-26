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
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className="fixed top-4 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
      <div
        className={`pointer-events-auto transition-all duration-500 ease-out flex items-center gap-2 rounded-full border border-white/10 bg-background/60 backdrop-blur-2xl backdrop-saturate-150 ${
          scrolled ? "shadow-2xl shadow-primary/10 py-1.5 pl-2 pr-2" : "shadow-lg shadow-black/20 py-2 pl-3 pr-3"
        }`}
        style={{ boxShadow: scrolled ? "0 8px 32px -8px oklch(0.6 0.2 290 / 0.25), inset 0 1px 0 0 oklch(1 0 0 / 0.05)" : undefined }}
      >
        <Link to="/" className="flex items-center gap-2 pl-1 pr-2">
          <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
            <img src={logoAsset.url} alt="" className="h-5 w-5 object-contain" />
          </div>
          <span className="font-semibold tracking-tight text-foreground text-sm">AdPilot</span>
        </Link>
        <span className="hidden md:block w-px h-5 bg-border/60 mx-1" />
        <nav className="hidden md:flex items-center">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-white/5"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="hidden md:block w-px h-5 bg-border/60 mx-1" />
        <div className="hidden md:flex items-center gap-1">
          <Link to="/auth" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-white/5">
            Login
          </Link>
          <Link to="/auth" className="press btn-primary text-[13px] px-4 py-1.5 rounded-full font-medium">
            Începe gratuit
          </Link>
        </div>
        <button
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>
      {open && (
        <div className="pointer-events-auto md:hidden absolute top-16 left-4 right-4 rounded-2xl border border-white/10 bg-background/90 backdrop-blur-2xl backdrop-saturate-150 shadow-2xl">
          <div className="px-4 py-4 flex flex-col gap-1">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="text-sm py-2.5 px-3 rounded-lg hover:bg-white/5">
                {l.label}
              </Link>
            ))}
            <div className="mt-2 pt-3 border-t border-border/60 flex flex-col gap-2">
              <Link to="/auth" onClick={() => setOpen(false)} className="text-sm py-2 px-3 rounded-lg hover:bg-white/5">Login</Link>
              <Link to="/auth" onClick={() => setOpen(false)} className="press btn-primary text-sm px-4 py-2.5 rounded-xl text-center font-medium">
                Începe gratuit
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}