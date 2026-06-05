import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

type Props = {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  canBack: boolean;
  canNext: boolean;
  nextLabel?: string;
  onBack: () => void;
  onNext: () => void;
  isSubmitting?: boolean;
  children: ReactNode;
};

export function WizardShell({
  step,
  total,
  title,
  subtitle,
  canBack,
  canNext,
  nextLabel = "Continue",
  onBack,
  onNext,
  isSubmitting,
  children,
}: Props) {
  const progress = (step / total) * 100;
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 press text-foreground disabled:opacity-30"
            disabled={!canBack}
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="text-[11px] font-medium text-muted-foreground tracking-wide">
              STEP {step} OF {total}
            </div>
            <div className="mt-1 h-[3px] bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-foreground rounded-full"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto px-5 pt-8 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="font-serif text-[32px] leading-tight font-semibold text-foreground">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            )}
            <div className="mt-8">{children}</div>
          </motion.div>
        </AnimatePresence>
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border z-30">
        <div className="max-w-md mx-auto px-5 py-4">
          <Button
            size="lg"
            className="w-full press h-12 rounded-full text-base font-medium"
            onClick={onNext}
            disabled={!canNext || isSubmitting}
          >
            {isSubmitting ? "Working…" : nextLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block text-[13px] font-medium text-foreground mb-2">
      {children}
    </label>
  );
}

export function ChoiceCard({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-5 rounded-2xl border-2 press transition-all ${
        active
          ? "border-foreground bg-secondary"
          : "border-border bg-card hover:border-muted-foreground/30"
      }`}
    >
      {children}
    </button>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium press transition-colors ${
        active
          ? "bg-foreground text-background"
          : "bg-secondary text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}