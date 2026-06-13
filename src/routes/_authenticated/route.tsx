import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, Plus, Inbox, MessageCircle, Settings } from "lucide-react";

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
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <Outlet />
      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const tabs = [
    { to: "/dashboard", icon: Home, label: "Acasă" },
    { to: "/leads", icon: Inbox, label: "Lead-uri" },
    { to: "/create", icon: Plus, label: "Creează" },
    { to: "/whatsapp", icon: MessageCircle, label: "WhatsApp" },
    { to: "/settings", icon: Settings, label: "Setări" },
  ] as const;
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-background/90 backdrop-blur-xl border-t border-border z-50">
      <div className="max-w-md mx-auto flex justify-around px-2 py-2">
        {tabs.map((t) => (
          <Link
            key={t.label}
            to={t.to}
            className="flex-1 flex flex-col items-center gap-1 py-2 text-muted-foreground hover:text-foreground transition-colors"
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