import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Search, Sparkles, LifeBuoy, Shield } from "lucide-react";
import { openCommandPalette } from "@/components/CommandPalette";
import { useServerFn } from "@tanstack/react-start";
import { isAdmin as isAdminFn } from "@/lib/admin.functions";

type Notif = { id: string; emoji: string; title: string; body: string; time: string };

const MOCK_NOTIFS: Notif[] = [
  { id: "1", emoji: "🎯", title: "Lead nou de pe TikTok", body: "Andrei P. — interesat de oferta de primăvară", time: "acum 2 min" },
  { id: "2", emoji: "🚀", title: "Campanie publicată", body: '„Reduceri vară" e live pe Meta', time: "acum 14 min" },
  { id: "3", emoji: "📈", title: "CTR în creștere", body: "+18% față de ieri — bun lucrat!", time: "acum 1 oră" },
];

const ACCENTS: { id: string; label: string; hue: string }[] = [
  { id: "violet", label: "Violet", hue: "290" },
  { id: "blue", label: "Albastru", hue: "250" },
  { id: "emerald", label: "Verde", hue: "155" },
  { id: "pink", label: "Roz", hue: "340" },
  { id: "amber", label: "Amber", hue: "60" },
];

const ACCENT_KEY = "adpilot:accent";

export function applyAccent(hue: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--primary", `oklch(0.62 0.22 ${hue})`);
  root.style.setProperty("--ring", `oklch(0.62 0.22 ${hue})`);
  root.style.setProperty(
    "--gradient-primary",
    `linear-gradient(135deg, oklch(0.62 0.22 ${hue}) 0%, oklch(0.7 0.2 ${Number(hue) + 25}) 100%)`,
  );
  root.style.setProperty(
    "--gradient-glow",
    `radial-gradient(circle at 50% 50%, oklch(0.7 0.2 ${hue} / 0.25), transparent 60%)`,
  );
}

export function AppHeader() {
  const [openNotif, setOpenNotif] = useState(false);
  const [accent, setAccent] = useState<string>("290");
  const [admin, setAdmin] = useState(false);
  const checkAdmin = useServerFn(isAdminFn);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(ACCENT_KEY) : null;
    if (saved) { setAccent(saved); applyAccent(saved); }
  }, []);

  useEffect(() => {
    checkAdmin().then((r) => setAdmin(r.admin)).catch(() => {});
  }, []);

  const pickAccent = (hue: string) => {
    setAccent(hue);
    localStorage.setItem(ACCENT_KEY, hue);
    applyAccent(hue);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-2xl backdrop-saturate-150">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-sm">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: "var(--gradient-primary)" }}>
            <Sparkles className="w-4 h-4" />
          </span>
          <span className="hidden sm:inline">AdPilot</span>
        </Link>

        <button
          onClick={openCommandPalette}
          className="press flex-1 max-w-md mx-auto flex items-center gap-2 h-9 px-3 rounded-full border border-border/60 bg-secondary/40 hover:bg-secondary text-muted-foreground text-sm transition-colors"
          aria-label="Deschide căutare"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left truncate">Caută campanii, lead-uri, comenzi…</span>
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-background/60 border border-border/60 font-mono">⌘K</kbd>
        </button>

        <div className="flex items-center gap-1">
          <Link to="/support" className="press w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary border border-transparent hover:border-border" title="Suport" aria-label="Suport">
            <LifeBuoy className="w-4 h-4" />
          </Link>
          {admin && (
            <Link to="/admin" className="press w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary border border-transparent hover:border-border text-primary" title="Admin" aria-label="Admin">
              <Shield className="w-4 h-4" />
            </Link>
          )}
          <details className="relative">
            <summary className="press list-none cursor-pointer w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary border border-transparent hover:border-border" title="Accent">
              <span className="w-4 h-4 rounded-full ring-2 ring-background" style={{ background: `oklch(0.62 0.22 ${accent})` }} />
            </summary>
            <div className="absolute right-0 mt-2 p-2 rounded-xl border border-border bg-popover shadow-xl flex gap-1.5 z-50">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => pickAccent(a.hue)}
                  title={a.label}
                  className={`w-7 h-7 rounded-full press transition-transform ${accent === a.hue ? "ring-2 ring-foreground ring-offset-2 ring-offset-popover scale-110" : ""}`}
                  style={{ background: `oklch(0.62 0.22 ${a.hue})` }}
                />
              ))}
            </div>
          </details>

          <button
            onClick={() => setOpenNotif((v) => !v)}
            className="press relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary border border-transparent hover:border-border"
            aria-label="Notificări"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background" />
          </button>
        </div>
      </div>

      {openNotif && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpenNotif(false)} />
          <div className="absolute right-4 md:right-6 top-14 mt-2 w-[340px] z-40 rounded-2xl border border-border bg-popover shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold">Notificări 🔔</p>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{MOCK_NOTIFS.length} noi</span>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-border">
              {MOCK_NOTIFS.map((n) => (
                <div key={n.id} className="px-4 py-3 hover:bg-secondary/40 transition-colors flex gap-3">
                  <div className="text-xl shrink-0 leading-none mt-0.5">{n.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              to="/dashboard"
              onClick={() => setOpenNotif(false)}
              className="block text-center text-xs text-primary font-medium py-3 border-t border-border hover:bg-secondary/40"
            >
              Marchează toate ca citite
            </Link>
          </div>
        </>
      )}
    </header>
  );
}