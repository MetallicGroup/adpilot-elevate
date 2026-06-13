import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, LayoutGroup } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Home, Plus, Inbox, MessageCircle, Settings } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { CommandPalette } from "@/components/CommandPalette";
import { OnboardingTour } from "@/components/OnboardingTour";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <AppHeader />
      <CommandPalette />
      <OnboardingTour />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: "/dashboard", icon: Home, label: "Acasă" },
    { to: "/leads", icon: Inbox, label: "Lead-uri" },
    { to: "/create", icon: Plus, label: "Creează" },
    { to: "/whatsapp", icon: MessageCircle, label: "WhatsApp" },
    { to: "/settings", icon: Settings, label: "Setări" },
  ] as const;
  return (
    <nav
      className="fixed bottom-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <LayoutGroup id="bottom-nav">
        <div
          className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-background/70 backdrop-blur-2xl backdrop-saturate-150 p-1.5 shadow-2xl shadow-black/40"
          style={{ boxShadow: "0 12px 40px -10px oklch(0.5 0.2 290 / 0.35), inset 0 1px 0 0 oklch(1 0 0 / 0.06)" }}
        >
          {tabs.map((t) => {
            const isActive = pathname === t.to || (t.to !== "/dashboard" && pathname.startsWith(t.to));
            const isCreate = t.to === "/create";
            if (isCreate) {
              return (
                <Link
                  key={t.label}
                  to={t.to}
                  className="press relative w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0"
                  style={{ background: "var(--gradient-primary)", boxShadow: "0 8px 24px -6px oklch(0.55 0.25 290 / 0.6)" }}
                  aria-label={t.label}
                >
                  <t.icon className="w-5 h-5" strokeWidth={2.5} />
                </Link>
              );
            }
            return (
              <Link
                key={t.label}
                to={t.to}
                className="press relative flex flex-col items-center justify-center gap-0.5 w-14 h-12 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                aria-label={t.label}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-active-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-full bg-primary/15 border border-primary/30"
                  />
                )}
                <span className={`relative z-10 transition-transform ${isActive ? "scale-110" : ""}`}>
                  <t.icon className={`w-[18px] h-[18px] ${isActive ? "text-primary" : ""}`} strokeWidth={isActive ? 2.5 : 2} />
                </span>
                <span className={`relative z-10 text-[9px] font-medium leading-none ${isActive ? "text-primary" : ""}`}>
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </LayoutGroup>
    </nav>
  );
}