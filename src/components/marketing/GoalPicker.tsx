import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { Reveal } from "@/components/wow/Reveal";
import { GOALS, GOAL_STORAGE_KEY, type GoalId } from "@/lib/goals";

export { GOALS, GOAL_STORAGE_KEY, type GoalId };

export function GoalPicker() {
  const [selected, setSelected] = useState<GoalId | null>(null);
  const active = GOALS.find((g) => g.id === selected);

  function pick(id: GoalId) {
    setSelected(id);
    try { window.localStorage.setItem(GOAL_STORAGE_KEY, id); } catch { /* ignore */ }
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {GOALS.map((g, i) => {
          const isOn = selected === g.id;
          return (
            <Reveal key={g.id} delay={i}>
              <button
                type="button"
                onClick={() => pick(g.id)}
                aria-pressed={isOn}
                className={`press w-full h-full text-left rounded-2xl p-5 sm:p-6 border transition-all ${
                  isOn
                    ? "border-primary/60 bg-card shadow-[var(--shadow-glow)] -translate-y-1"
                    : "border-border bg-card/60 hover:-translate-y-1 hover:border-primary/40"
                }`}
              >
                <div
                  className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: isOn ? "var(--gradient-primary)" : "oklch(0.62 0.22 295 / 0.15)" }}
                >
                  <g.icon className={`h-5 w-5 ${isOn ? "text-white" : "text-primary"}`} />
                </div>
                <h3 className="font-semibold leading-snug">{g.label}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{g.short}</p>
              </button>
            </Reveal>
          );
        })}
      </div>

      <div
        className={`overflow-hidden transition-all duration-500 ${active ? "mt-6 max-h-64 opacity-100" : "mt-0 max-h-0 opacity-0"}`}
        aria-live="polite"
      >
        {active && (
          <div className="glass rounded-2xl p-5 sm:p-6 text-center sm:text-left sm:flex sm:items-center sm:gap-6">
            <p className="flex-1 text-sm leading-relaxed text-foreground/90">
              <Sparkles className="mr-2 inline h-4 w-4 text-primary" />
              {active.confirm}
            </p>
            <Link
              to="/auth"
              search={{ goal: active.id }}
              className="press btn-primary mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold sm:mt-0 sm:w-auto"
            >
              Creează campania mea <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
