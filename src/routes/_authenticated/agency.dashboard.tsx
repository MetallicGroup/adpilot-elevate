import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Copy, Check, Users, Building2, ExternalLink, Settings } from "lucide-react";
import { toast } from "sonner";
import { getAgencyClients } from "@/lib/agency.functions";

export const Route = createFileRoute("/_authenticated/agency/dashboard")({
  ssr: false,
  component: AgencyDashboard,
});

type ClientRow = {
  id: string;
  client_name: string | null;
  facebook_page_name: string | null;
  ad_account_name: string | null;
  status: string;
  connected_at: string | null;
  leadsToday: number;
  spendToday: number;
};

function AgencyDashboard() {
  const navigate = useNavigate();
  const load = useServerFn(getAgencyClients);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    load()
      .then((r) => {
        if (!r.agency) {
          navigate({ to: "/agency/setup", replace: true });
          return;
        }
        setData(r);
      })
      .catch(() => setData({ agency: null, clients: [], slots: { used: 0, total: 0 } }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data?.agency) return null;

  const inviteLink =
    (typeof window !== "undefined" ? window.location.origin : "https://adpilot.ro") +
    "/connect/" +
    data.agency.slug;
  const clients: ClientRow[] = data.clients ?? [];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Link copiat!");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Nu am putut copia. Copiază manual.");
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      connected: "bg-emerald-500/15 text-emerald-500",
      invited: "bg-blue-500/15 text-blue-500",
      disconnected: "bg-muted text-muted-foreground",
    };
    const label: Record<string, string> = {
      connected: "Conectat",
      invited: "Invitat",
      disconnected: "Deconectat",
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs ${map[s] ?? "bg-muted"}`}>{label[s] ?? s}</span>;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary text-sm">
            <Building2 className="w-4 h-4" /> Agenție
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{data.agency.name}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground inline-flex items-center gap-2">
            <Users className="w-4 h-4" />
            <b className="text-foreground">{data.slots.connected}</b> conectați
            {data.slots.extra > 0 ? (
              <span className="text-amber-500">· {data.slots.extra} × {data.slots.extraPrice} lei</span>
            ) : (
              <span>· {data.slots.included} incluse</span>
            )}
          </span>
          <Link to="/agency/settings" className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border hover:bg-secondary">
            <Settings className="w-4 h-4" /> Setări
          </Link>
        </div>
      </div>

      {/* Invite link */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium mb-1">Linkul tău de invitație</p>
        <p className="text-xs text-muted-foreground mb-3">
          Trimite-l clienților — ei se conectează cu Facebook în 60 de secunde.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            readOnly
            value={inviteLink}
            className="flex-1 h-11 rounded-lg border border-border bg-secondary/40 px-3 text-sm font-mono"
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="flex gap-2">
            <button onClick={copy} className="press btn-primary inline-flex items-center gap-2 px-4 h-11 rounded-lg text-sm font-semibold">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copiat" : "Copiază"}
            </button>
            <a href={inviteLink} target="_blank" rel="noreferrer" className="press inline-flex items-center justify-center px-3 h-11 rounded-lg border border-border hover:bg-secondary">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Clients */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Clienți ({clients.length})</h2>
        {clients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Niciun client încă. Trimite linkul de invitație de mai sus ca să conectezi primul client.
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Lead-uri azi</th>
                  <th className="px-3 py-2 font-medium">Spend azi</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-secondary/30">
                    <td className="px-3 py-2.5">
                      <Link to="/agency/clients/$id" params={{ id: c.id }} className="block">
                        <div className="font-medium text-primary hover:underline">{c.client_name || "Client"}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.facebook_page_name || "—"}
                          {c.ad_account_name ? ` · ${c.ad_account_name}` : ""}
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">{statusBadge(c.status)}</td>
                    <td className="px-3 py-2.5 font-medium">{c.status === "connected" ? c.leadsToday : "—"}</td>
                    <td className="px-3 py-2.5">{c.status === "connected" ? `${c.spendToday.toFixed(2)} lei` : "—"}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Link to="/agency/clients/$id" params={{ id: c.id }} className="text-xs text-primary hover:underline">
                        Deschide →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
