import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  isAdmin,
  listAdminUsers,
  listAllTickets,
  getAdminDashboard,
  listAllCampaigns,
  listBroadcasts,
  listAuditLog,
  createBroadcast,
  adminSetCampaignStatus,
  type AdminUserRow,
} from "@/lib/admin.functions";
import {
  Users,
  MessageSquare,
  ShieldAlert,
  Loader2,
  Search,
  LayoutDashboard,
  Megaphone,
  Activity,
  Target,
  TrendingUp,
  AlertTriangle,
  Pause,
  Play,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Tab = "dashboard" | "users" | "tickets" | "campaigns" | "broadcast" | "audit";

function AdminPage() {
  const checkAdmin = useServerFn(isAdmin);
  const loadDash = useServerFn(getAdminDashboard);
  const loadUsers = useServerFn(listAdminUsers);
  const loadTickets = useServerFn(listAllTickets);
  const loadCampaigns = useServerFn(listAllCampaigns);
  const loadBroadcasts = useServerFn(listBroadcasts);
  const loadAudit = useServerFn(listAuditLog);

  const [allowed, setAllowed] = useState<null | boolean>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(true);

  const [dash, setDash] = useState<any>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await checkAdmin();
        setAllowed(r.admin);
        if (!r.admin) return;
        const [d, u, t, c, b, a] = await Promise.all([
          loadDash(),
          loadUsers(),
          loadTickets(),
          loadCampaigns(),
          loadBroadcasts(),
          loadAudit(),
        ]);
        setDash(d);
        setUsers(u.users);
        setTickets(t.tickets);
        setCampaigns(c.campaigns);
        setBroadcasts(b.broadcasts);
        setAudit(a.entries);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (allowed === false) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 text-center">
        <ShieldAlert className="w-12 h-12 mx-auto text-destructive mb-4" />
        <h1 className="text-xl font-semibold">Acces interzis</h1>
        <p className="text-sm text-muted-foreground mt-2">Această pagină este doar pentru administratori.</p>
      </div>
    );
  }

  if (loading || allowed === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Panou Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {dash?.kpis?.total_users ?? 0} utilizatori · {dash?.kpis?.open_tickets ?? 0} tichete deschise · {(dash?.kpis?.total_spend ?? 0).toFixed(0)} lei spend total
        </p>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        <TabBtn active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" />
        <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon={<Users className="w-4 h-4" />} label={`Useri (${users.length})`} />
        <TabBtn active={tab === "tickets"} onClick={() => setTab("tickets")} icon={<MessageSquare className="w-4 h-4" />} label={`Tichete (${dash?.kpis?.open_tickets ?? 0})`} />
        <TabBtn active={tab === "campaigns"} onClick={() => setTab("campaigns")} icon={<Target className="w-4 h-4" />} label={`Campanii (${campaigns.length})`} />
        <TabBtn active={tab === "broadcast"} onClick={() => setTab("broadcast")} icon={<Megaphone className="w-4 h-4" />} label="Broadcast" />
        <TabBtn active={tab === "audit"} onClick={() => setTab("audit")} icon={<Activity className="w-4 h-4" />} label="Audit" />
      </div>

      {tab === "dashboard" && <DashboardView dash={dash} />}
      {tab === "users" && <UsersTable users={users} />}
      {tab === "tickets" && <TicketsTable tickets={tickets} />}
      {tab === "campaigns" && <CampaignsTable campaigns={campaigns} onChange={async () => { const c = await loadCampaigns(); setCampaigns(c.campaigns); }} />}
      {tab === "broadcast" && <BroadcastView broadcasts={broadcasts} onSent={async () => { const b = await loadBroadcasts(); setBroadcasts(b.broadcasts); }} />}
      {tab === "audit" && <AuditTable entries={audit} />}
    </div>
  );
}

function DashboardView({ dash }: { dash: any }) {
  if (!dash) return null;
  const k = dash.kpis;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total useri" value={k.total_users} sub={`+${k.new_signups_7d} ultimele 7 zile`} icon={<Users className="w-4 h-4" />} />
        <Kpi label="Trial activ" value={k.trial_users} sub={`${k.expiring_trials_3d} expiră în 3 zile`} icon={<AlertTriangle className="w-4 h-4 text-amber-500" />} />
        <Kpi label="Abonament activ" value={k.active_subs} sub={`${k.suspended_users} suspendați`} icon={<TrendingUp className="w-4 h-4 text-emerald-500" />} />
        <Kpi label="Cheltuit total" value={`${Number(k.total_spend).toFixed(0)} lei`} sub={`${k.total_leads} lead-uri generate`} icon={<Target className="w-4 h-4" />} />
        <Kpi label="Campanii" value={k.total_campaigns} sub={`${k.active_campaigns} active · ${k.meta_campaigns} Meta`} icon={<Target className="w-4 h-4" />} />
        <Kpi label="WhatsApp" value={`${k.wa_connected}/${k.wa_total}`} sub="conectați" icon={<MessageSquare className="w-4 h-4 text-emerald-500" />} />
        <Kpi label="Tichete deschise" value={k.open_tickets} sub={`${k.urgent_tickets} urgente`} icon={<MessageSquare className="w-4 h-4 text-amber-500" />} />
        <Kpi label="Conversion" value={k.total_users > 0 ? `${((k.active_subs / k.total_users) * 100).toFixed(1)}%` : "—"} sub="trial → paid" icon={<TrendingUp className="w-4 h-4" />} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Sparkline title="Înregistrări (30 zile)" data={dash.signups_30d} valueKey="count" />
        <Sparkline title="Spend zilnic (30 zile)" data={dash.spend_30d} valueKey="spend" suffix=" lei" />
      </div>
    </div>
  );
}

function Sparkline({ title, data, valueKey, suffix = "" }: { title: string; data: any[]; valueKey: string; suffix?: string }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey] ?? 0)));
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <div className="flex items-end gap-1 h-32">
        {data.length === 0 && <p className="text-xs text-muted-foreground">Date insuficiente.</p>}
        {data.map((d, i) => {
          const h = (Number(d[valueKey] ?? 0) / max) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d[valueKey]}${suffix}`}>
              <div className="w-full rounded-t bg-primary/60 hover:bg-primary transition" style={{ height: `${Math.max(2, h)}%` }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
        <span>{data[0]?.date ?? ""}</span>
        <span>{data[data.length - 1]?.date ?? ""}</span>
      </div>
    </div>
  );
}

function UsersTable({ users }: { users: AdminUserRow[] }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => users.filter((u) => {
    if (planFilter !== "all" && u.plan !== planFilter) return false;
    if (statusFilter !== "all" && u.subscription_status !== statusFilter) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (u.email ?? "").toLowerCase().includes(s) || (u.full_name ?? "").toLowerCase().includes(s);
  }), [users, q, planFilter, statusFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută email, nume…" className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-secondary/40 text-sm" />
        </div>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="h-9 rounded-md border border-border bg-secondary/40 text-sm px-2">
          <option value="all">Toate planurile</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="premium">Premium</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-border bg-secondary/40 text-sm px-2">
          <option value="all">Toate statusurile</option>
          <option value="trial">Trial</option>
          <option value="active">Activ</option>
          <option value="past_due">Restant</option>
          <option value="canceled">Anulat</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} rezultate</span>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Camp.</th>
              <th className="px-3 py-2 font-medium">Cheltuit</th>
              <th className="px-3 py-2 font-medium">Lead-uri</th>
              <th className="px-3 py-2 font-medium">WA</th>
              <th className="px-3 py-2 font-medium">Tichete</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-border hover:bg-secondary/30 cursor-pointer" onClick={() => navigate({ to: "/admin/users/$id", params: { id: u.id } })}>
                <td className="px-3 py-2">
                  <div className="font-medium">{u.full_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="px-3 py-2 capitalize">{u.plan}</td>
                <td className="px-3 py-2"><StatusBadge status={u.subscription_status} /></td>
                <td className="px-3 py-2">{u.campaign_count} <span className="text-xs text-muted-foreground">({u.active_campaigns})</span></td>
                <td className="px-3 py-2">{u.total_spend.toFixed(2)} lei</td>
                <td className="px-3 py-2">{u.total_leads}</td>
                <td className="px-3 py-2">{u.wa_connected ? "✅" : "—"}</td>
                <td className="px-3 py-2">{u.open_tickets > 0 ? <span className="text-amber-500 font-medium">{u.open_tickets}</span> : "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (<tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Niciun rezultat.</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TicketsTable({ tickets }: { tickets: any[] }) {
  const [statusF, setStatusF] = useState("all");
  const [priorityF, setPriorityF] = useState("all");
  const filtered = tickets.filter((t) => {
    if (statusF !== "all" && t.status !== statusF) return false;
    if (priorityF !== "all" && (t.priority ?? "normal") !== priorityF) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="h-9 rounded-md border border-border bg-secondary/40 text-sm px-2">
          <option value="all">Toate</option>
          <option value="open">Deschise</option>
          <option value="closed">Închise</option>
        </select>
        <select value={priorityF} onChange={(e) => setPriorityF(e.target.value)} className="h-9 rounded-md border border-border bg-secondary/40 text-sm px-2">
          <option value="all">Toate prioritățile</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40"><tr className="text-left">
            <th className="px-3 py-2 font-medium">Subiect</th>
            <th className="px-3 py-2 font-medium">User</th>
            <th className="px-3 py-2 font-medium">Prioritate</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Ultim mesaj</th>
          </tr></thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-t border-border hover:bg-secondary/30">
                <td className="px-3 py-2"><Link to="/admin/tickets/$id" params={{ id: t.id }} className="font-medium text-primary hover:underline">{t.subject}</Link></td>
                <td className="px-3 py-2">{t.user_name || t.user_id.slice(0, 8)}</td>
                <td className="px-3 py-2"><PriorityBadge priority={t.priority ?? "normal"} /></td>
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${t.status === "open" ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground"}`}>{t.status === "open" ? "deschis" : "închis"}</span></td>
                <td className="px-3 py-2 text-muted-foreground text-xs">{new Date(t.last_message_at).toLocaleString("ro-RO")}</td>
              </tr>
            ))}
            {filtered.length === 0 && (<tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Niciun tichet.</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignsTable({ campaigns, onChange }: { campaigns: any[]; onChange: () => void }) {
  const setStatus = useServerFn(adminSetCampaignStatus);
  const [statusF, setStatusF] = useState("all");
  const [platformF, setPlatformF] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = campaigns.filter((c) => {
    if (statusF !== "all" && c.status !== statusF) return false;
    if (platformF !== "all" && c.platform !== platformF) return false;
    return true;
  });

  const toggle = async (c: any) => {
    setBusy(c.id);
    try {
      const next = c.status === "active" ? "paused" : "active";
      await setStatus({ data: { campaign_id: c.id, status: next as any } });
      await onChange();
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="h-9 rounded-md border border-border bg-secondary/40 text-sm px-2">
          <option value="all">Toate statusurile</option>
          <option value="active">Active</option>
          <option value="paused">Pe pauză</option>
        </select>
        <select value={platformF} onChange={(e) => setPlatformF(e.target.value)} className="h-9 rounded-md border border-border bg-secondary/40 text-sm px-2">
          <option value="all">Toate platformele</option>
          <option value="meta">Meta</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} campanii</span>
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40"><tr className="text-left">
            <th className="px-3 py-2">Nume</th>
            <th className="px-3 py-2">User</th>
            <th className="px-3 py-2">Platf.</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Buget</th>
            <th className="px-3 py-2">Cheltuit</th>
            <th className="px-3 py-2">Lead-uri</th>
            <th className="px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2">
                  <Link to="/admin/users/$id" params={{ id: c.user_id }} className="text-primary hover:underline">
                    {c.user_name || c.user_id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-3 py-2 capitalize">{c.platform}</td>
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${c.status === "active" ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"}`}>{c.status}</span></td>
                <td className="px-3 py-2">{Number(c.budget).toFixed(0)} lei</td>
                <td className="px-3 py-2">{Number(c.spend).toFixed(2)} lei</td>
                <td className="px-3 py-2">{c.leads}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => toggle(c)} disabled={busy === c.id} className="text-xs px-2 py-1 rounded-md border border-border hover:bg-secondary inline-flex items-center gap-1">
                    {busy === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : c.status === "active" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {c.status === "active" ? "Pauză" : "Pornește"}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (<tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Nicio campanie.</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BroadcastView({ broadcasts, onSent }: { broadcasts: any[]; onSent: () => void }) {
  const send = useServerFn(createBroadcast);
  const [body, setBody] = useState("");
  const [segment, setSegment] = useState<"all" | "trial" | "active" | "premium" | "pro">("all");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const submit = async () => {
    if (!body.trim()) return;
    if (!confirm(`Trimit acest mesaj către segmentul „${segment}"?`)) return;
    setSending(true);
    setResult(null);
    try {
      const r = await send({ data: { body: body.trim(), segment } });
      setResult(`Trimis la ${r.sent}/${r.total} utilizatori (${r.failed} eșuate).`);
      setBody("");
      await onSent();
    } catch (e: any) {
      setResult(`Eroare: ${e.message}`);
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold">Mesaj nou WhatsApp în masă</h3>
        <div className="flex gap-2">
          <label className="text-sm">Segment:</label>
          <select value={segment} onChange={(e) => setSegment(e.target.value as any)} className="h-8 rounded-md border border-border bg-secondary/40 text-sm px-2">
            <option value="all">Toți utilizatorii activi</option>
            <option value="trial">Doar trial</option>
            <option value="active">Doar abonați activi</option>
            <option value="premium">Doar Premium</option>
            <option value="pro">Doar Pro</option>
          </select>
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Anunț, ofertă, update… (max 4000 caractere)" className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm resize-none" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{body.length}/4000 · doar useri cu WhatsApp conectat și activ</span>
          <button onClick={submit} disabled={sending || !body.trim()} className="px-4 py-2 rounded-lg text-white disabled:opacity-50 inline-flex items-center gap-2" style={{ background: "var(--gradient-primary)" }}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
            Trimite broadcast
          </button>
        </div>
        {result && <p className="text-sm">{result}</p>}
      </div>

      <div>
        <h3 className="font-semibold mb-3">Istoric broadcast-uri ({broadcasts.length})</h3>
        <div className="space-y-2">
          {broadcasts.map((b) => (
            <div key={b.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm font-medium capitalize">{b.segment} · {b.channel}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(b.created_at).toLocaleString("ro-RO")} · {b.total_sent}/{b.total_recipients} trimise{b.total_failed > 0 ? `, ${b.total_failed} eșuate` : ""}
                </div>
              </div>
              <p className="text-sm mt-2 text-muted-foreground whitespace-pre-wrap break-words">{b.body}</p>
            </div>
          ))}
          {broadcasts.length === 0 && <p className="text-sm text-muted-foreground">Niciun broadcast trimis.</p>}
        </div>
      </div>
    </div>
  );
}

function AuditTable({ entries }: { entries: any[] }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-secondary/40"><tr className="text-left">
          <th className="px-3 py-2">Când</th>
          <th className="px-3 py-2">Admin</th>
          <th className="px-3 py-2">Acțiune</th>
          <th className="px-3 py-2">Țintă</th>
          <th className="px-3 py-2">Detalii</th>
        </tr></thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-border">
              <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(e.created_at).toLocaleString("ro-RO")}</td>
              <td className="px-3 py-2 text-xs">{e.actor_email || e.actor_id?.slice(0, 8)}</td>
              <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
              <td className="px-3 py-2 text-xs">{e.target_type}: {e.target_id?.slice(0, 8)}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground"><code className="text-[10px]">{e.details ? JSON.stringify(e.details).slice(0, 80) : "—"}</code></td>
            </tr>
          ))}
          {entries.length === 0 && (<tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Niciun eveniment.</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function Kpi({ label, value, sub, icon }: { label: string; value: number | string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
      {icon}{label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    trial: "bg-blue-500/15 text-blue-500",
    active: "bg-emerald-500/15 text-emerald-500",
    past_due: "bg-amber-500/15 text-amber-500",
    canceled: "bg-red-500/15 text-red-500",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs ${map[status] ?? "bg-muted"}`}>{status}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    urgent: "bg-red-500/15 text-red-500",
    high: "bg-amber-500/15 text-amber-500",
    normal: "bg-muted text-muted-foreground",
    low: "bg-secondary text-muted-foreground",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs ${map[priority] ?? "bg-muted"}`}>{priority}</span>;
}