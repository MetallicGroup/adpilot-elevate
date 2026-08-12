import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { GOALS, GOAL_META, GOAL_STORAGE_KEY, isGoalId, type GoalId } from "@/lib/goals";
import { getGoalSetupState, saveOnboardingGoal } from "@/lib/goal-setup.functions";
import { PixelSetup } from "./PixelSetup";
import { LandingBuilder } from "./LandingBuilder";

function clearStoredGoal() {
  try {
    window.localStorage.removeItem(GOAL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function GoalSetupStep({ onPublished }: { onPublished?: (url: string) => void }) {
  const loadState = useServerFn(getGoalSetupState);
  const saveGoal = useServerFn(saveOnboardingGoal);

  const [goal, setGoal] = useState<GoalId | null>(null);
  const [defaults, setDefaults] = useState<{ business_name?: string | null; city?: string | null; phone?: string | null }>({});
  const [loading, setLoading] = useState(true);
  const [salesFallback, setSalesFallback] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(GOAL_STORAGE_KEY);
    } catch {
      stored = null;
    }
    loadState({})
      .then((s: any) => {
        const picked = isGoalId(s.goal) ? s.goal : isGoalId(stored) ? stored : null;
        setGoal(picked);
        setDefaults({
          business_name: s.business?.name ?? s.pages?.[0]?.page_name ?? null,
          city: s.business?.city ?? null,
          phone: s.business?.phone ?? null,
        });
        if (picked && picked !== s.goal) void saveGoal({ data: { goal: picked } }).catch(() => {});
        if (picked) clearStoredGoal();
      })
      .catch(() => setGoal(isGoalId(stored) ? stored : null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(id: GoalId) {
    setGoal(id);
    setSalesFallback(false);
    try {
      window.localStorage.setItem(GOAL_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    void saveGoal({ data: { goal: id } }).catch(() => {});
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Se încarcă…
      </div>
    );
  }

  if (!goal) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">Alege ce vrei să obții și configurăm totul pentru tine.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {GOALS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => pick(g.id)}
              className="press rounded-2xl border border-border bg-card/60 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40"
            >
              <g.icon className="h-5 w-5 text-primary" />
              <p className="mt-2.5 font-semibold leading-snug">{g.label}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{g.short}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const meta = GOAL_META[goal];
  const showLanding = goal !== "sales" || salesFallback;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">{salesFallback ? "Îți construim o pagină AdPilot" : meta.setupTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {salesFallback ? "Fără site și fără Pixel — pagina o găzduim noi." : meta.setupDesc}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setGoal(null);
            setSalesFallback(false);
          }}
          className="press rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Schimbă obiectivul
        </button>
      </div>

      {showLanding ? (
        <LandingBuilder
          objective={salesFallback ? "leads" : (goal as "bookings" | "leads" | "calls")}
          defaults={defaults}
          onPublished={onPublished}
        />
      ) : (
        <PixelSetup onSwitchToLanding={() => setSalesFallback(true)} />
      )}
    </div>
  );
}
