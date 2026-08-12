import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, RefreshCw, ShoppingBag } from "lucide-react";
import { detectMetaPixels } from "@/lib/goal-setup.functions";

type Pixel = { id: string; name: string; ad_account_id: string; last_fired_time: string | null; active: boolean };

export function PixelSetup({ onSwitchToLanding }: { onSwitchToLanding: () => void }) {
  const detect = useServerFn(detectMetaPixels);
  const [pixels, setPixels] = useState<Pixel[] | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await detect({});
      setPixels(r.pixels as Pixel[]);
    } catch {
      setPixels([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const best = pixels?.find((p) => p.active) ?? pixels?.[0] ?? null;

  return (
    <div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Căutăm Pixelul în contul tău Meta…
        </div>
      ) : best ? (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5">
          <div className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <div className="min-w-0">
              <p className="font-medium">Pixel găsit: {best.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {best.active
                  ? "Primește deja evenimente. Îl folosim ca să optimizăm reclamele după vânzări reale."
                  : "Nu a primit evenimente recent. Îl putem folosi, dar verifică instalarea pe site."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">ID: {best.id}</p>
            </div>
          </div>
          <Link
            to="/create"
            search={{ goal: "sales" }}
            className="press btn-primary mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"
          >
            Continuă spre campania de vânzări <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card/60 p-5">
          <div className="flex items-start gap-3">
            <ShoppingBag className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Nu am găsit niciun Pixel activ</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Fie contul de reclame nu e conectat încă, fie magazinul nu are Pixel instalat. Poți
                încerca din nou după ce îl instalezi, sau poți porni cu o pagină AdPilot care nu are
                nevoie de site.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={load}
              className="press inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm"
            >
              <RefreshCw className="h-4 w-4" /> Caută din nou
            </button>
            <button
              type="button"
              onClick={onSwitchToLanding}
              className="press btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              Fă-mi o pagină AdPilot <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
