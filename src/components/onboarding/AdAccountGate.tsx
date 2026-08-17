import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getMetaAdReadiness,
  autoCreateAdAccount,
  type AdReadinessResult,
} from "@/lib/meta-ad-readiness.functions";
import { Loader2, Check, CreditCard, ExternalLink, Megaphone, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

/**
 * Poarta dintre conectarea Meta și alegerea planului: userul trebuie să aibă un
 * cont de reclame ȘI un card pe el, altfel nu poate rula reclame (ar plăti degeaba).
 * Contul îl creăm automat; cardul îl adaugă în Facebook (nu se poate prin API) și
 * verificăm continuu până apare.
 */
export function AdAccountGate({
  connected,
  onReady,
}: {
  connected: boolean;
  onReady: () => void;
}) {
  const check = useServerFn(getMetaAdReadiness);
  const createFn = useServerFn(autoCreateAdAccount);

  const [state, setState] = useState<AdReadinessResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [waitingCard, setWaitingCard] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notified = useRef(false);

  const ready = !!state && state.hasAdAccount && state.hasCard;

  const refresh = async (): Promise<AdReadinessResult | null> => {
    try {
      const r = await check({});
      setState(r);
      if (r.hasAdAccount && r.hasCard && !notified.current) {
        notified.current = true;
        onReady();
      }
      if (r.hasAdAccount) setCreating(false);
      if (r.hasCard) setWaitingCard(false);
      return r;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (connected) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  // Polling doar cât timp așteptăm ceva (creare cont / adăugare card).
  useEffect(() => {
    const stop = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    if (!connected || ready) {
      stop();
      return;
    }
    if ((creating || waitingCard) && !pollRef.current) {
      pollRef.current = setInterval(() => void refresh(), 4000);
    }
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, ready, creating, waitingCard]);

  const handleCreate = async () => {
    setBusy(true);
    setManual(null);
    try {
      const res = await createFn({});
      if (res.ok) {
        setCreating(true);
        toast.success("Cont de reclame creat ✅");
        await refresh();
      } else if (res.needsManual) {
        setManual(res.error);
      } else {
        toast.error(res.error);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Nu am putut crea contul");
    } finally {
      setBusy(false);
    }
  };

  const handleAddCard = () => {
    if (!state?.paymentUrl) return;
    window.open(state.paymentUrl, "_blank", "noopener,noreferrer");
    setWaitingCard(true);
  };

  if (!connected) {
    return (
      <GateShell>
        <p className="text-sm text-muted-foreground">
          Conectează Facebook mai întâi ca să verificăm contul de reclame.
        </p>
      </GateShell>
    );
  }

  // Tot e gata → bifă verde.
  if (ready) {
    return (
      <GateShell tone="ok">
        <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium">
          <Check className="w-4 h-4" /> Cont de reclame și card verificate — totul e pregătit.
        </div>
      </GateShell>
    );
  }

  // Încă verificăm prima dată.
  if (state === null) {
    return (
      <GateShell>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Verificăm contul tău de reclame…
        </div>
      </GateShell>
    );
  }

  // Nu are cont de reclame.
  if (!state.hasAdAccount) {
    return (
      <GateShell>
        <StepLine done={false} label="Cont de reclame" />
        {manual ? (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-amber-500">
              <AlertTriangle className="w-4 h-4" /> Nu am putut crea contul automat
            </p>
            <p className="mt-1 text-muted-foreground">{manual}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="https://business.facebook.com/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="press inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1877F2] text-white text-xs font-medium"
              >
                Deschide Facebook Business <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => void refresh()}
                className="press inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium"
              >
                Am creat contul, verifică
              </button>
            </div>
          </div>
        ) : creating ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Se creează contul de reclame… durează câteva
            momente.
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Nu ai încă un cont de reclame. Îl creăm noi automat, cu numele paginii tale — apeși un
              buton și gata.
            </p>
            <button
              onClick={handleCreate}
              disabled={busy}
              className="press mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
              Creează cont de reclame
            </button>
          </>
        )}
      </GateShell>
    );
  }

  // Are cont, dar nu are card.
  return (
    <GateShell>
      <StepLine done label="Cont de reclame" />
      <StepLine done={false} label="Card (metodă de plată)" />
      {waitingCard ? (
        <div className="mt-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Aștept să adaugi cardul în fereastra
            Facebook deschisă… verific automat.
          </div>
          <button
            onClick={() => void refresh()}
            className="press mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium"
          >
            Am adăugat cardul, verifică acum
          </button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Ai contul de reclame{state.adAccountName ? ` „${state.adAccountName}"` : ""}, dar nu are
            un card. Adaugă-l în Facebook (nu se poate din altă parte) și verific eu automat când e
            gata.
          </p>
          <button
            onClick={handleAddCard}
            className="press mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1877F2] text-white font-medium"
          >
            <CreditCard className="w-4 h-4" /> Adaugă card în Facebook
            <ExternalLink className="w-4 h-4" />
          </button>
        </>
      )}
    </GateShell>
  );
}

function GateShell({ children, tone }: { children: React.ReactNode; tone?: "ok" }) {
  return (
    <section className="mt-5 card-floating p-7">
      <div className="flex items-start gap-4">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            tone === "ok" ? "bg-emerald-500/15 text-emerald-500" : "bg-primary/15 text-primary"
          }`}
        >
          <Megaphone className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-lg">Cont de reclame &amp; card</h2>
          {children}
        </div>
      </div>
    </section>
  );
}

function StepLine({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 text-sm">
      {done ? (
        <Check className="w-4 h-4 text-emerald-500" />
      ) : (
        <span className="w-4 h-4 rounded-full border border-muted-foreground/40 inline-block" />
      )}
      <span className={done ? "text-emerald-500" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
