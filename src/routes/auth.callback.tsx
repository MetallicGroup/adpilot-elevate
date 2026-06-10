import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallbackPage,
  head: () => ({ meta: [{ title: "Signing in — AdPilot" }] }),
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const authError = params.get("error_description") ?? params.get("error");

      if (authError) {
        toast.error(decodeURIComponent(authError));
        if (!cancelled) navigate({ to: "/auth", replace: true });
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          toast.error(error.message);
          if (!cancelled) navigate({ to: "/auth", replace: true });
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        if (!cancelled) navigate({ to: "/dashboard", replace: true });
        return;
      }

      toast.error("Nu am putut finaliza autentificarea.");
      if (!cancelled) navigate({ to: "/auth", replace: true });
    }

    finish();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Te conectăm la cont...</p>
    </div>
  );
}
