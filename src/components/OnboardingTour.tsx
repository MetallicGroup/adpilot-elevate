import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Plus, Inbox, MessageCircle, ArrowRight, X } from "lucide-react";

const KEY = "adpilot:onboarded:v1";

const STEPS = [
  {
    emoji: "👋",
    title: "Bine ai venit în AdPilot!",
    body: "Hai să-ți arăt în 30 de secunde cum lansezi prima ta campanie pe Facebook sau Instagram — fără agenție.",
    icon: Sparkles,
  },
  {
    emoji: "🎯",
    title: "Creează o campanie",
    body: "Apasă butonul violet din bara de jos. AI-ul generează audiență, text și creative — tu doar dai launch.",
    icon: Plus,
  },
  {
    emoji: "📨",
    title: "Lead-urile vin singure",
    body: "Fiecare lead apare instant în Lead-uri. Drawer cu istoric, notițe, bulk actions și export CSV.",
    icon: Inbox,
  },
  {
    emoji: "💬",
    title: "Asistent pe WhatsApp",
    body: 'Întreabă „Câte lead-uri azi?" sau „Pornește campania" direct pe WhatsApp. AI-ul răspunde în română.',
    icon: MessageCircle,
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(KEY)) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    localStorage.setItem(KEY, "1");
    setOpen(false);
  };

  const s = STEPS[step];
  const Icon = s?.icon ?? Sparkles;
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {open && s && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-4 bg-background/70 backdrop-blur-md"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md card-floating-lg p-7"
          >
            <button
              onClick={close}
              className="press absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary"
              aria-label="Închide"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-2xl shrink-0"
                style={{ background: "var(--gradient-primary)" }}
              >
                {s.emoji}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Pas {step + 1} din {STEPS.length}
                </p>
                <h3 className="font-semibold text-lg truncate flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary" /> {s.title}
                </h3>
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{s.body}</p>

            <div className="mt-5 flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all ${i === step ? "w-8 bg-primary" : "w-2 bg-border"}`}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center gap-2">
              <button
                onClick={close}
                className="press text-sm px-4 py-2 rounded-lg text-muted-foreground hover:bg-secondary"
              >
                Sari peste
              </button>
              <div className="ml-auto flex items-center gap-2">
                {step > 0 && (
                  <button
                    onClick={() => setStep((s) => s - 1)}
                    className="press text-sm px-4 py-2 rounded-lg border border-border hover:bg-secondary"
                  >
                    Înapoi
                  </button>
                )}
                {!isLast ? (
                  <button
                    onClick={() => setStep((s) => s + 1)}
                    className="press btn-primary text-sm px-5 py-2 rounded-lg inline-flex items-center gap-1.5"
                  >
                    Continuă <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <Link
                    to="/create"
                    onClick={close}
                    className="press btn-primary text-sm px-5 py-2 rounded-lg inline-flex items-center gap-1.5"
                  >
                    Hai să creez! <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}