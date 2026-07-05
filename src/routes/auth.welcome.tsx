import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/welcome")({
  ssr: false,
  component: WelcomePage,
  head: () => ({ meta: [{ title: "Bun venit — AdPilot" }] }),
});

function WelcomePage() {
  const navigate = useNavigate();
  const [name, setName] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      const meta = data.user.user_metadata as { full_name?: string; name?: string };
      const first = (meta.full_name ?? meta.name ?? data.user.email ?? "").split(" ")[0];
      setName(first);
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-md"
      >
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-7 h-7 text-primary" />
        </div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight mt-6">
          {name ? `Bun venit, ${name}!` : "Bun venit!"}
        </h1>
        <p className="text-muted-foreground text-sm mt-3 leading-relaxed">
          Suntem gata să-ți lansăm prima reclamă Facebook. Îți conectăm contul Meta și pornim în
          mai puțin de 5 minute.
        </p>
        <button
          onClick={() => navigate({ to: "/onboarding", replace: true })}
          className="press mt-8 w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Continuă <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
}