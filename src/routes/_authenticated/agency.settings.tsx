import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Loader2, ArrowLeft, Save, Upload, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import {
  getAgencySettings,
  updateAgency,
  uploadAgencyLogo,
  disableWhiteLabel,
} from "@/lib/agency.functions";

export const Route = createFileRoute("/_authenticated/agency/settings")({
  ssr: false,
  component: AgencySettings,
});

function AgencySettings() {
  const navigate = useNavigate();
  const load = useServerFn(getAgencySettings);
  const save = useServerFn(updateAgency);
  const upload = useServerFn(uploadAgencyLogo);
  const disableWL = useServerFn(disableWhiteLabel);
  const { openCheckout, checkoutElement } = useStripeCheckout();
  const fileRef = useRef<HTMLInputElement>(null);

  const [ag, setAg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    load()
      .then((r) => {
        if (!r.agency) {
          navigate({ to: "/agency/setup", replace: true });
          return;
        }
        setAg(r.agency);
        setName(r.agency.name);
        setSlug(r.agency.slug);
      })
      .finally(() => setLoading(false));
  useEffect(() => {
    refresh();
  }, []);

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ data: { name: name.trim(), slug: slug.trim().toLowerCase() } });
      toast.success("Salvat.");
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Eroare la salvare.");
    } finally {
      setBusy(false);
    }
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_800_000) {
      toast.error("Imagine prea mare (max ~1.8MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(true);
      try {
        await upload({ data: { dataUrl: String(reader.result) } });
        toast.success("Logo încărcat.");
        await refresh();
      } catch (err: any) {
        toast.error(err?.message ?? "Eroare la încărcare.");
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function turnOffWL() {
    if (!confirm("Dezactivezi white-label? Pagina de conectare va afișa din nou branding-ul AdPilot.")) return;
    setBusy(true);
    try {
      await disableWL();
      toast.success("White-label dezactivat.");
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Eroare.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!ag) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://adpilot.ro";

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 space-y-6">
      <Link to="/agency/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Înapoi la dashboard
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Setări agenție</h1>

      {/* Info */}
      <form onSubmit={saveInfo} className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Nume agenție</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="h-11 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Slug (linkul de invitație)</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} required className="h-11 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm font-mono" />
          <p className="mt-1.5 text-xs text-muted-foreground">{origin}/connect/{slug || "…"}</p>
        </div>
        <button type="submit" disabled={busy} className="press btn-primary inline-flex items-center gap-2 px-4 h-11 rounded-lg text-sm font-semibold disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvează
        </button>
      </form>

      {/* White-label */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">White-label</h2>
        </div>
        {ag.white_label_enabled ? (
          <>
            <p className="text-sm text-emerald-500 flex items-center gap-1.5 mb-4">
              <Check className="w-4 h-4" /> Activ — logo-ul tău apare pe pagina de conectare, fără branding AdPilot.
            </p>
            <div className="flex items-center gap-4 mb-4">
              {ag.logo_url ? (
                <img src={ag.logo_url} alt="Logo" className="h-12 object-contain rounded-lg bg-secondary/40 p-2" />
              ) : (
                <div className="h-12 w-24 grid place-items-center rounded-lg bg-secondary/40 text-xs text-muted-foreground">fără logo</div>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={onLogo} className="hidden" />
              <button onClick={() => fileRef.current?.click()} disabled={busy} className="press inline-flex items-center gap-2 px-4 h-10 rounded-lg border border-border hover:bg-secondary text-sm disabled:opacity-50">
                <Upload className="w-4 h-4" /> Încarcă logo
              </button>
            </div>
            <button onClick={turnOffWL} disabled={busy} className="text-sm text-red-500 hover:underline">
              Dezactivează white-label
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Pune logo-ul agenției tale pe pagina de conectare a clienților și scoate branding-ul AdPilot.
            </p>
            <button
              onClick={() => openCheckout({ priceId: "agency_whitelabel" })}
              className="press btn-primary inline-flex items-center gap-2 px-4 h-11 rounded-lg text-sm font-semibold"
            >
              Activează white-label — +500 lei/lună
            </button>
          </>
        )}
      </div>

      {/* Abonament agenție */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold mb-1">Abonament agenție</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Planul de agenție (995 lei/lună, 2 afaceri incluse). Fiecare afacere peste 2 se facturează automat cu +249 lei/lună.
        </p>
        <button
          onClick={() => openCheckout({ priceId: "agency_monthly" })}
          className="press inline-flex items-center gap-2 px-4 h-11 rounded-lg border border-border hover:bg-secondary text-sm font-semibold"
        >
          Gestionează abonamentul
        </button>
      </div>

      {checkoutElement}
    </div>
  );
}
