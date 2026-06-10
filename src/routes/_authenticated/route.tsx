import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, Plus, BarChart3, Settings, Users } from "lucide-react";

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
  return (
    <div className="min-h-screen bg-background pb-24">
      <Outlet />
      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const tabs = [
    { to: "/dashboard", icon: Home, label: "Home" },
    { to: "/create", icon: Plus, label: "Create" },
    { to: "/leads", icon: Users, label: "Clienți" },
    { to: "/reports", icon: BarChart3, label: "Reports" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ] as const;
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-background/90 backdrop-blur border-t border-border z-50">
      <div className="max-w-md mx-auto flex justify-around px-2 py-2">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="flex-1 flex flex-col items-center gap-1 py-2 text-muted-foreground data-[status=active]:text-foreground transition-colors"
            activeProps={{ className: "text-foreground" }}
          >
            <t.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}