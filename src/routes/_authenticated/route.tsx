import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, Plus, BarChart3, Settings, Users, Sparkles, CalendarCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session?.user) throw redirect({ to: "/auth" });

    // Gate onboarding: nu lăsăm userul în aplicație până nu a conectat Facebook
    // ȘI a ales un plan. Excludem /onboarding (ar face buclă) și /checkout (revenire
    // de la plată). Fail-open: dacă verificarea pică, NU blocăm userul.
    const p = location.pathname;
    if (!p.startsWith("/onboarding") && !p.startsWith("/checkout")) {
      let complete = true;
      try {
        const { getOnboardingStatus } = await import("@/lib/onboarding.functions");
        const { getStripeEnvironment } = await import("@/lib/stripe");
        const status = await getOnboardingStatus({ data: { environment: getStripeEnvironment() } });
        complete = status.isAdmin || !!(status.hasMetaConnection && status.planChosen && status.whatsappConnected);
      } catch {
        complete = true; // eroare de verificare → lăsăm userul să treacă
      }
      if (!complete) throw redirect({ to: "/onboarding" });
    }

    return { user: session.user };
  },
  component: AuthLayout,
});

const TABS = [
  { to: "/dashboard", icon: Home, label: "Acasă" },
  { to: "/create", icon: Plus, label: "Creează" },
  { to: "/leads", icon: Users, label: "Clienți" },
  { to: "/reports", icon: BarChart3, label: "Rapoarte" },
  { to: "/settings", icon: Settings, label: "Setări" },
] as const;

function AuthLayout() {
  return (
    <div className="min-h-screen pb-24 lg:pb-0 lg:pl-[248px]">
      <DesktopSidebar />
      <Outlet />
      <BottomNav />
    </div>
  );
}

function DesktopSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col justify-between border-r border-white/[0.06] bg-black/25 px-4 py-6 backdrop-blur-xl lg:flex">
      <div>
        <Link to="/dashboard" className="mb-8 flex items-center gap-2.5 px-2 font-bold tracking-tight">
          <img src="/adpilot-icon.png" alt="AdPilot" className="h-9 w-9 rounded-xl object-contain" />
          AdPilot
        </Link>

        <nav className="grid gap-1">
          {TABS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
              activeProps={{
                className:
                  "bg-primary/12 text-foreground border border-primary/25 shadow-[inset_0_1px_0_oklch(1_0_0/0.06)]",
              }}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </Link>
          ))}
          <Link
            to="/bookings"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
            activeProps={{ className: "bg-primary/12 text-foreground border border-primary/25" }}
          >
            <CalendarCheck className="h-4 w-4" />
            Programări
          </Link>
        </nav>
      </div>

      <Link
        to="/create"
        className="press btn-primary shine flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
      >
        <Plus className="h-4 w-4" /> Campanie nouă
      </Link>
    </aside>
  );
}

function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-white/[0.06] bg-background/85 backdrop-blur-xl lg:hidden">
      <div className="max-w-md mx-auto flex justify-around px-2 py-2">
        {TABS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="flex-1 flex flex-col items-center gap-1 py-2 text-muted-foreground transition-colors"
            activeProps={{ className: "text-primary" }}
          >
            <t.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
