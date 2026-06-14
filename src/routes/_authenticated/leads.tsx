import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Search, Filter, Music2, Facebook, Inbox, Mail, Phone, Calendar, X, Trash2, CheckSquare } from "lucide-react";
import { listLeads, updateLead, bulkLeads, syncMetaLeads, LEAD_STATUSES, type LeadRow, type LeadStatus } from "@/lib/leads.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
});

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nou",
  contacted: "Contactat",
  qualified: "Calificat",
  appointment_scheduled: "Programare",
  won: "Câștigat",
  lost: "Pierdut",
};

function LeadsPage() {
  const fetchLeads = useServerFn(listLeads);
  const patchLead = useServerFn(updateLead);
  const bulkFn = useServerFn(bulkLeads);
  const syncFn = useServerFn(syncMetaLeads);
  const [syncing, setSyncing] = useState(false);

  const [platform, setPlatform] = useState<"all" | "tiktok" | "meta">("all");
  const [status, setStatus] = useState<"all" | LeadStatus>("all");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [sinceDays, setSinceDays] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; platform: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [openLead, setOpenLead] = useState<LeadRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const reload = async () => {
    setLoading(true);
    try {
      const r = await fetchLeads({ data: { platform, status, campaign_id: campaignId, search, since_days: sinceDays } });
      setLeads(r.leads);
      setCampaigns(r.campaigns);
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e?.message ?? "Nu am putut încărca lead-urile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(reload, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, status, campaignId, search, sinceDays]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length };
    for (const s of LEAD_STATUSES) c[s] = 0;
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  const onChangeStatus = async (lead: LeadRow, next: LeadStatus) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: next } : l)));
    try {
      await patchLead({ data: { id: lead.id, status: next } });
      toast.success(`Marcat ca: ${STATUS_LABELS[next]}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Actualizare eșuată");
      reload();
    }
  };

  const toggleSel = (id: string) => {
    setSelected((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map((l) => l.id)));
  };
  const bulkStatus = async (s: LeadStatus) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    try {
      await bulkFn({ data: { ids, action: "status", status: s } });
      toast.success(`${ids.length} lead-uri → ${STATUS_LABELS[s]}`);
      reload();
    } catch (e: any) { toast.error(e?.message ?? "Eșuat"); }
  };
  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (!confirm(`Ștergi ${ids.length} lead-uri? Acțiunea e definitivă.`)) return;
    try {
      await bulkFn({ data: { ids, action: "delete" } });
      toast.success(`${ids.length} lead-uri șterse`);
      reload();
    } catch (e: any) { toast.error(e?.message ?? "Eșuat"); }
  };

  const exportCsv = () => {
    const header = ["Creat", "Platformă", "Campanie", "Nume", "Email", "Telefon", "Status", "Mesaj"];
    const lines = [header.join(",")];
    for (const l of leads) {
      lines.push(
        [
          new Date(l.created_at).toISOString(),
          l.platform,
          csv(l.campaign_name ?? ""),
          csv(l.full_name ?? ""),
          csv(l.email ?? ""),
          csv(l.phone ?? ""),
          l.status,
          csv(l.message ?? ""),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-5xl mx-auto px-5 pt-10 pb-24"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">CRM</p>
          <h1 className="text-3xl font-bold tracking-tight mt-1">Lead-uri 📋</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {leads.length} {leads.length === 1 ? "lead" : "lead-uri"} de pe TikTok & Meta
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/meta-status"
            className="press text-sm px-4 py-2 rounded-lg border border-border hover:bg-secondary"
          >
            Status Meta
          </Link>
          <button
            disabled={syncing}
            onClick={async () => {
              setSyncing(true);
              try {
                const r = await syncFn({ data: {} as never });
                toast.success(`Sincronizat: ${r.inserted} lead-uri noi din ${r.forms} formulare`);
                reload();
              } catch (e: any) {
                toast.error(e?.message ?? "Sincronizare eșuată");
              } finally {
                setSyncing(false);
              }
            }}
            className="press text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {syncing ? "Se sincronizează…" : "Sincronizează din Meta"}
          </button>
          <button
            onClick={exportCsv}
            className="press text-sm px-4 py-2 rounded-lg border border-border hover:bg-secondary"
          >
            Exportă CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 card-floating p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Caută după nume, email sau telefon…"
            className="h-11 pl-9 rounded-xl"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={platform === "all"} onClick={() => setPlatform("all")}>Toate platformele</FilterChip>
          <FilterChip active={platform === "tiktok"} onClick={() => setPlatform("tiktok")}>
            <Music2 className="w-3.5 h-3.5" /> TikTok
          </FilterChip>
          <FilterChip active={platform === "meta"} onClick={() => setPlatform("meta")}>
            <Facebook className="w-3.5 h-3.5" /> Meta
          </FilterChip>
          <div className="mx-2 h-5 w-px bg-border" />
          <select
            value={campaignId ?? ""}
            onChange={(e) => setCampaignId(e.target.value || null)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="">Toate campaniile</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.platform})
              </option>
            ))}
          </select>
          <select
            value={sinceDays ?? ""}
            onChange={(e) => setSinceDays(e.target.value ? Number(e.target.value) : null)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="">Oricând</option>
            <option value="1">Azi</option>
            <option value="7">Ultimele 7 zile</option>
            <option value="30">Ultimele 30 zile</option>
            <option value="90">Ultimele 90 zile</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={status === "all"} onClick={() => setStatus("all")}>
            <Filter className="w-3.5 h-3.5" /> Toate ({counts.all})
          </FilterChip>
          {LEAD_STATUSES.map((s) => (
            <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>
              {STATUS_LABELS[s]} ({counts[s] ?? 0})
            </FilterChip>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="mt-4 card-floating p-3 flex flex-wrap items-center gap-2"
        >
          <span className="text-sm font-medium px-2">{selected.size} selectate</span>
          <div className="mx-1 h-5 w-px bg-border" />
          {LEAD_STATUSES.map((s) => (
            <button key={s} onClick={() => bulkStatus(s)} className="press text-xs px-3 py-1.5 rounded-full border border-border hover:bg-secondary">
              → {STATUS_LABELS[s]}
            </button>
          ))}
          <div className="mx-1 h-5 w-px bg-border" />
          <button onClick={bulkDelete} className="press text-xs px-3 py-1.5 rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 inline-flex items-center gap-1.5">
            <Trash2 className="w-3 h-3" /> Șterge
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto press text-xs px-3 py-1.5 rounded-full hover:bg-secondary">
            Anulează
          </button>
        </motion.div>
      )}

      {/* List */}
      <div className="mt-6">
        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="card-floating p-4 animate-pulse">
                <div className="h-4 w-1/3 bg-muted rounded" />
                <div className="mt-2 h-3 w-1/2 bg-muted/60 rounded" />
              </div>
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="card-floating p-10 text-center">
            <div className="text-5xl">📭</div>
            <h3 className="mt-4 font-semibold">Niciun lead încă</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Lead-urile vor apărea aici automat când campaniile tale TikTok/Meta colectează contacte. ✨
            </p>
            <Link
              to="/create"
              className="press mt-5 inline-flex items-center gap-2 px-5 py-3 btn-primary rounded-xl text-sm font-medium"
            >
              Creează campanie
            </Link>
            <div className="hidden">
              <Inbox />
            </div>
          </div>
        ) : (
          <div className="card-floating divide-y divide-border overflow-hidden">
            <div className="px-4 py-2 flex items-center gap-3 bg-secondary/30 text-xs text-muted-foreground">
              <button onClick={toggleAll} className="press inline-flex items-center gap-1.5 hover:text-foreground">
                <CheckSquare className="w-3.5 h-3.5" />
                {selected.size === leads.length ? "Deselectează tot" : "Selectează tot"}
              </button>
            </div>
            {leads.map((l) => (
              <LeadRowItem
                key={l.id}
                lead={l}
                selected={selected.has(l.id)}
                onToggleSelect={() => toggleSel(l.id)}
                onOpen={() => setOpenLead(l)}
                onChangeStatus={onChangeStatus}
              />
            ))}
          </div>
        )}
      </div>

      {openLead && (
        <LeadDrawer
          lead={openLead}
          onClose={() => setOpenLead(null)}
          onChangeStatus={(next) => onChangeStatus(openLead, next)}
          onSaveNotes={async (notes) => {
            try {
              await patchLead({ data: { id: openLead.id, notes } });
              setLeads((prev) => prev.map((x) => (x.id === openLead.id ? { ...x, notes } : x)));
              setOpenLead({ ...openLead, notes });
              toast.success("Notiță salvată ✓");
            } catch (e: any) {
              toast.error(e?.message ?? "Nu am putut salva");
            }
          }}
        />
      )}
    </motion.div>
  );
}

function LeadRowItem({
  lead,
  selected,
  onToggleSelect,
  onOpen,
  onChangeStatus,
}: {
  lead: LeadRow;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onChangeStatus: (l: LeadRow, s: LeadStatus) => void;
}) {
  return (
    <div className={`p-4 flex items-center gap-4 hover:bg-secondary/40 transition-colors ${selected ? "bg-primary/5" : ""}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        className="w-4 h-4 rounded border-border accent-primary shrink-0"
        aria-label="Selectează lead"
      />
      <button onClick={onOpen} className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          {lead.platform === "meta" ? (
            <Facebook className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <Music2 className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className="font-medium truncate">{lead.full_name || lead.email || lead.phone || "Unnamed lead"}</span>
          {lead.campaign_name && (
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">
              · {lead.campaign_name}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground truncate">
          {lead.email && (
            <span className="inline-flex items-center gap-1 truncate">
              <Mail className="w-3 h-3" /> {lead.email}
            </span>
          )}
          {lead.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="w-3 h-3" /> {lead.phone}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {new Date(lead.created_at).toLocaleDateString()}
          </span>
        </div>
      </button>
      <select
        value={lead.status}
        onChange={(e) => onChangeStatus(lead, e.target.value as LeadStatus)}
        className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>
    </div>
  );
}

function LeadDrawer({
  lead,
  onClose,
  onChangeStatus,
  onSaveNotes,
}: {
  lead: LeadRow;
  onClose: () => void;
  onChangeStatus: (s: LeadStatus) => void;
  onSaveNotes: (notes: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState(lead.notes ?? "");
  useEffect(() => setNotes(lead.notes ?? ""), [lead.id]);
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-background border-l border-border overflow-y-auto">
        <div className="p-5 flex items-center justify-between border-b border-border">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {lead.platform === "meta" ? "Lead Meta" : "Lead TikTok"}
            </p>
            <h2 className="font-serif text-xl font-semibold mt-0.5">
              {lead.full_name || lead.email || lead.phone || "Lead fără nume"}
            </h2>
          </div>
          <button onClick={onClose} className="press p-2 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <Field label="Email" value={lead.email} />
          <Field label="Telefon" value={lead.phone} />
          <Field label="Campanie" value={lead.campaign_name ?? "—"} />
          <Field label="Primit" value={new Date(lead.created_at).toLocaleString("ro-RO")} />
          {lead.message && <Field label="Mesaj" value={lead.message} />}

          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {LEAD_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => onChangeStatus(s)}
                  className={`press text-xs px-3 py-1.5 rounded-full border ${
                    lead.status === s ? "bg-foreground text-background border-foreground" : "border-border hover:bg-secondary"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Notițe</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              placeholder="Adaugă o notiță de follow-up…"
              className="mt-2 rounded-xl min-h-28"
            />
            <button
              onClick={() => onSaveNotes(notes)}
              className="press mt-2 text-sm px-4 py-2 rounded-lg bg-foreground text-background"
            >
              Salvează nota
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words">{value || "—"}</p>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`press inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
        active ? "bg-foreground text-background border-foreground" : "border-border hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function csv(s: string) {
  if (s == null) return "";
  const needsQuote = /[",\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}