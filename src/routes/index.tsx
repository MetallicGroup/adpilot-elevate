import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, BarChart3, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AdPilot — Run TikTok Ads. Effortlessly." },
      { name: "description", content: "Connect your account. Launch campaigns. Watch results. All in one place." },
      { property: "og:title", content: "AdPilot — Run TikTok Ads. Effortlessly." },
      { property: "og:description", content: "Connect your account. Launch campaigns. Watch results. All in one place." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 pt-8 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
            <span className="text-background text-sm font-bold">A</span>
          </div>
          <span className="font-semibold tracking-tight">AdPilot</span>
        </div>
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Sign in
        </Link>
      </header>

      <main className="flex-1 flex flex-col justify-center px-6 py-16 max-w-2xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h1 className="font-serif text-5xl md:text-7xl font-semibold leading-[1.05] tracking-tight">
            Run TikTok Ads.
            <br />
            <span className="text-muted-foreground">Effortlessly.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-md leading-relaxed">
            Connect your account. Launch campaigns. Watch results. All in one place.
          </p>

          <Link
            to="/auth"
            className="press mt-10 inline-flex items-center justify-center gap-2 w-full md:w-auto px-8 py-4 bg-foreground text-background rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="mt-24 grid gap-4 md:grid-cols-3"
        >
          {[
            { icon: Sparkles, title: "Campaign Creation", body: "Launch in minutes, not hours." },
            { icon: BarChart3, title: "Smart Analytics", body: "Know what's working at a glance." },
            { icon: Zap, title: "Auto-Optimization", body: "AI insights for every campaign." },
          ].map((f) => (
            <div key={f.title} className="card-floating p-5">
              <f.icon className="w-5 h-5 text-foreground" />
              <h3 className="mt-3 font-semibold text-sm">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </motion.div>
      </main>

      <footer className="px-6 pb-8 max-w-6xl mx-auto w-full text-xs text-muted-foreground">
        © {new Date().getFullYear()} AdPilot
      </footer>
    </div>
  );
}
