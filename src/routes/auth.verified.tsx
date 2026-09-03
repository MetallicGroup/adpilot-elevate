import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { resolvePostAuthPath } from "@/lib/post-auth";

export const Route = createFileRoute("/auth/verified")({
  ssr: false,
  component: VerifiedPage,
  head: () => ({ meta: [{ title: "Email confirmat — AdPilot" }] }),
});

function VerifiedPage() {
  const navigate = useNavigate();
  const [dest, setDest] = useState<"/dashboard" | "/onboarding" | "/agency/dashboard">("/onboarding");

  useEffect(() => {
    let cancelled = false;
    resolvePostAuthPath().then((d) => {
      if (!cancelled) setDest(d);
    });
    const t = setTimeout(() => {
      if (!cancelled) navigate({ to: dest, replace: true });
    }, 1600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [navigate, dest]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-sm"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center"
        >
          <CheckCircle2 className="w-9 h-9 text-emerald-500" />
        </motion.div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight mt-6">
          Emailul tău e confirmat
        </h1>
        <p className="text-muted-foreground text-sm mt-3">
          Te ducem la {dest === "/dashboard" ? "dashboard" : "onboarding"} într-o clipă…
        </p>
      </motion.div>
    </div>
  );
}
