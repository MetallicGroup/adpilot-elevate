import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { isAdmin, listAdminUsers, listAllTickets, type AdminUserRow } from "@/lib/admin.functions";
import { Users, MessageSquare, ShieldAlert, Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const checkAdmin = useServerFn(isAdmin);
  const loadUsers = useServerFn(listAdminUsers);
  const loadTickets = useServerFn(listAllTickets);
  const navigate = useNavigate();

  const [allowed, setAllowed] = useState<null | boolean>(null);
  const [tab, setTab] = useState<"users" | "tickets">("users");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await checkAdmin();
        setAllowed(r.admin);
        if (!r.admin) return;
        const [u, t] = await Promise.all([loadUsers(), loadTickets()]);
        setUsers(u.users);
        setTickets(t.tickets);
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

  const filteredUsers = users.filter((u) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      (u.email ?? "").toLowerCase().includes(s) ||
      (u.full_name ?? "").toLowerCase().includes(s) ||
      u.plan.toLowerCase().includes(s)
    );
  });

  const openTicketsCount = tickets.filter((t) => t.status === "open").length;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panou Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {users.length} utilizatori · {openTicketsCount} tichete deschise
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total utilizatori" value={users.length} />
        <StatCard label="Trial activ" value={users.filter((u) => u.subscription_status === "trial").length} />
        <StatCard label="Abonament activ" value={users.filter((u) => u.subscription_status === "active").length} />
        <StatCard label="Cheltuit total" value={`${users.reduce((s, u) => s + u.total_spend, 0).toFixed(0)} lei`} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon={<Users className="w-4 h-4" />} label={`Utilizatori (${users.length})`} />
        <TabBtn active={tab === "tickets"} onClick={() => setTab("tickets")} icon={<MessageSquare className="w-4 h-4" />} label={`Tichete (${openTicketsCount})`} />
      </div>

      {tab === "users" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Caută email, nume, plan…"
                className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-secondary/40 text-sm"
              />
            </div>
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
                {filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-border hover:bg-secondary/30 cursor-pointer"
                    onClick={() => navigate({ to: "/admin/users/$id", params: { id: u.id } })}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{u.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-3 py-2 capitalize">{u.plan}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={u.subscription_status} />
                    </td>
                    <td className="px-3 py-2">
                      {u.campaign_count} <span className="text-xs text-muted-foreground">({u.active_campaigns} active)</span>
                    </td>
                    <td className="px-3 py-2">{u.total_spend.toFixed(2)} lei</td>
                    <td className="px-3 py-2">{u.total_leads}</td>
                    <td className="px-3 py-2">{u.wa_connected ? "✅" : "—"}</td>
                    <td className="px-3 py-2">
                      {u.open_tickets > 0 ? <span className="text-amber-500 font-medium">{u.open_tickets}</span> : "—"}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Niciun utilizator.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "tickets" && (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Subiect</th>
                <th className="px-3 py-2 font-medium">Utilizator</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Ultim mesaj</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-3 py-2">
                    <Link
                      to="/admin/tickets/$id"
                      params={{ id: t.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {t.subject}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{t.user_name || t.user_id.slice(0, 8)}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${t.status === "open" ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground"}`}>
                      {t.status === "open" ? "deschis" : "închis"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {new Date(t.last_message_at).toLocaleString("ro-RO")}
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Niciun tichet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
    >
      {icon}
      {label}
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