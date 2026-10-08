import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, Plus, BarChart3, Settings, Users, CalendarCheck } from "lucide-react";

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
    if (!p.startsWith("/onboarding") && !p.startsWith("/checkout") && !p.startsWith("/agency")) {
      let complete = true;
      try {
        const { getOnboardingStatus } = await import("@/lib/onboarding.functions");
        const { getStripeEnvironment } = await import("@/lib/stripe");
        const status = await getOnboardingStatus({ data: { environment: getStripeEnvironment() } });
        // Clienții cu abonament activ (și adminii) NU mai trec prin onboarding —
        // sunt deja instalați. Gate-ul complet (FB + plan + WhatsApp) rămâne DOAR
        // pentru conturile fără abonament plătit.
        complete =
          status.isAdmin ||
          status.accountType === "agency" ||
          status.hasActiveSubscription ||
          !!(
            !status.needsEmail &&
            status.hasMetaConnection &&
            status.planChosen &&
            status.whatsappConnected
          );
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
  // Onboarding is a full-screen flow with its own dark layout; no app shell around it.
  const onboarding = useRouterState({ select: (st) => st.location.pathname.startsWith("/onboarding") });
  if (onboarding) return <Outlet />;

  return (
    <div className="app-light relative min-h-screen pb-24 lg:pb-0 lg:pl-[248px]">
      <DesktopSidebar />
      <Outlet />
      <BottomNav />
    </div>
  );
}

const NAV_ITEM =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-[#b9b6cf] transition-colors hover:bg-white/[0.06] hover:text-white";
const NAV_ACTIVE = { className: "bg-white/10 text-white" };

function DesktopSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col justify-between bg-[#0a0912] px-4 py-6 text-white lg:flex">
      <div>
        <Link to="/dashboard" className="mb-8 flex items-center gap-2.5 px-2 font-serif text-[21px]">
          <img src="/adpilot-icon.png" alt="" className="h-[34px] w-[34px] object-contain" />
          AdPilot
        </Link>

        <nav className="grid gap-1">
          {TABS.map((t) => (
            <Link key={t.to} to={t.to} className={NAV_ITEM} activeProps={NAV_ACTIVE}>
              <t.icon className="h-[18px] w-[18px]" />
              {t.label}
            </Link>
          ))}
          <Link to="/bookings" className={NAV_ITEM} activeProps={NAV_ACTIVE}>
            <CalendarCheck className="h-[18px] w-[18px]" />
            Programări
          </Link>
        </nav>
      </div>

      <Link
        to="/create"
        className="press flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold text-white"
        style={{ background: "var(--gradient-primary)" }}
      >
        <Plus className="h-4 w-4" /> Campanie nouă
      </Link>
    </aside>
  );
}

function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/90 backdrop-blur-xl lg:hidden">
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
