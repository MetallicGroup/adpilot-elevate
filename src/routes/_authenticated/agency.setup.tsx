import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { createAgency, getMyAgency } from "@/lib/agency.functions";

export const Route = createFileRoute("/_authenticated/agency/setup")({
  ssr: false,
  component: AgencySetup,
});

function AgencySetup() {
  const navigate = useNavigate();
  const create = useServerFn(createAgency);
  const mine = useServerFn(getMyAgency);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    mine()
      .then((r) => {
        if (r.agency) navigate({ to: "/agency/dashboard", replace: true });
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      await create({ data: { name: name.trim() } });
      toast.success("Cont de agenție creat 🎉");
      navigate({ to: "/agency/dashboard", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Nu am putut crea agenția.");
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-primary/12 text-primary">
          <Building2 className="h-6 w-6" />
        </div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Cont de agenție</p>
        <h1 className="mt-2 font-serif text-3xl md:text-4xl font-semibold tracking-tight">
          Cum se numește agenția ta?
        </h1>
        <p className="mt-3 text-muted-foreground">
          Numele apare pe pagina de conectare a clienților și în dashboard-ul tău.
        </p>
        <form onSubmit={submit} className="mt-7 grid gap-3">
          <input
            type="text"
            placeholder="Ex: Metallic Group"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            className="h-[52px] w-full rounded-[13px] border border-white/[0.08] bg-black/25 px-3.5 text-sm outline-none transition focus:border-primary/55 focus:ring-4 focus:ring-primary/10"
          />
          <button
            type="submit"
            disabled={busy}
            className="press btn-primary shine flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] text-sm font-semibold disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Creează agenția
          </button>
        </form>
      </div>
    </div>
  );
}
