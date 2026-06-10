import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Users, Download, Search, ChevronDown } from "lucide-react";
import {
  syncAllLeads,
  getCrmLeads,
  setLeadStatus,
  setLeadNotes,
  exportLeadsCsv,
} from "@/lib/leads.functions";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/launcher/types";
import type { CrmLead } from "@/lib/crm/leads.service";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
});

function LeadsPage() {
  const sync = useServerFn(syncAllLeads);
  const fetchLeads = useServerFn(getCrmLeads);
  const updateStatus = useServerFn(setLeadStatus);
  const saveNotes = useServerFn(setLeadNotes);
  const exportCsv = useServerFn(exportLeadsCsv);

  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [platformFilter, setPlatformFilter] = useState<"all" | "meta" | "tiktok">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  async function load(syncFirst = false) {
    if (syncFirst) setSyncing(true);
    else setLoading(true);
    try {
      if (syncFirst) {
        const result = await sync();
        setLeads(result.leads);
        if (result.synced > 0) toast.success(`${result.synced} lead-uri noi sincronizate`);
      } else {
        const data = await fetchLeads({
          data: {
            status: statusFilter === "all" ? undefined : statusFilter,
            platform: platformFilter === "all" ? undefined : platformFilter,
            search: search || undefined,
          },
        });
        setLeads(data);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Nu am putut încărca lead-urile");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter, platformFilter]);

  const filtered = useMemo(() => {
    if (!search) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        l.name?.toLowerCase().includes(q) ||
        l.phone?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q),
    );
  }, [leads, search]);

  async function onExport() {
    try {
      const { csv } = await exportCsv();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-adpilot-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export eșuat");
    }
  }

  const statusLabel = (s: string) => LEAD_STATUSES.find((x) => x.value === s)?.label ?? s;

  return (
    <div className="max-w-md mx-auto px-5 pt-10 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold">Clienți</h1>
        <div className="flex gap-1">
          <button onClick={onExport} className="press p-2 rounded-xl border border-border text-muted-foreground" aria-label="Export CSV">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={() => load(true)} disabled={syncing} className="press p-2 rounded-xl border border-border text-muted-foreground disabled:opacity-50" aria-label="Sincronizează">
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Toate lead-urile din Meta și TikTok — într-un singur loc.</p>

      <div className="mt-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Caută după nume, telefon, email…"
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-sm"
        />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>Toate</FilterChip>
        {LEAD_STATUSES.map((s) => (
          <FilterChip key={s.value} active={statusFilter === s.value} onClick={() => setStatusFilter(s.value)}>{s.label}</FilterChip>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        {(["all", "meta", "tiktok"] as const).map((p) => (
          <FilterChip key={p} active={platformFilter === p} onClick={() => setPlatformFilter(p)}>
            {p === "all" ? "Toate platformele" : p === "meta" ? "Meta" : "TikTok"}
          </FilterChip>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 card-floating p-6 text-sm text-muted-foreground">Se încarcă…</div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 card-floating p-8 text-center">
          <Users className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Niciun lead încă. Pornește o reclamă și le vei vedea aici instant.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map((lead) => (
            <div key={lead.id} className="card-floating overflow-hidden">
              <button
                className="w-full p-4 text-left"
                onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{lead.name ?? "Necunoscut"}</p>
                    <p className="text-sm text-muted-foreground">{lead.phone ?? lead.email ?? "—"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-full ${lead.platform === "meta" ? "bg-meta/10 text-meta" : "bg-tiktok/10 text-tiktok"}`}>
                      {lead.platform === "meta" ? "Meta" : "TikTok"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{statusLabel(lead.status)}</span>
                  </div>
                </div>
                {lead.campaign_name && <p className="mt-1 text-[11px] text-muted-foreground">{lead.campaign_name}</p>}
              </button>

              {expandedId === lead.id && (
                <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                  {Object.entries(lead.custom_answers).length > 0 && (
                    <div className="text-sm space-y-1">
                      {Object.entries(lead.custom_answers).map(([k, v]) => (
                        <p key={k}><span className="text-muted-foreground">{k}:</span> {v}</p>
                      ))}
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-muted-foreground">Status</label>
                    <div className="relative mt-1">
                      <select
                        value={lead.status}
                        onChange={async (e) => {
                          await updateStatus({ data: { lead_id: lead.id, status: e.target.value } });
                          setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: e.target.value as LeadStatus } : l)));
                          toast.success("Status actualizat");
                        }}
                        className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm appearance-none"
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Notițe</label>
                    <textarea
                      value={noteDraft[lead.id] ?? lead.notes ?? ""}
                      onChange={(e) => setNoteDraft((p) => ({ ...p, [lead.id]: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-border p-3 text-sm min-h-16"
                      placeholder="Adaugă o notiță…"
                    />
                    <button
                      className="mt-2 text-xs font-medium underline"
                      onClick={async () => {
                        const notes = noteDraft[lead.id] ?? "";
                        await saveNotes({ data: { lead_id: lead.id, notes } });
                        toast.success("Notiță salvată");
                      }}
                    >
                      Salvează notița
                    </button>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Primit: {new Date(lead.created_at).toLocaleString("ro-RO")}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium press ${
        active ? "bg-foreground text-background" : "bg-secondary text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
