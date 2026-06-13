import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAdminUserDetail, setUserPlan, isAdmin } from "@/lib/admin.functions";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users/$id")({
  component: UserDetailPage,
});

function UserDetailPage() {
  const { id } = Route.useParams();
  const checkAdmin = useServerFn(isAdmin);
  const load = useServerFn(getAdminUserDetail);
  const updatePlan = useServerFn(setUserPlan);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);

  const refresh = async () => {
    const r = await load({ data: { user_id: id } });
    setData(r);
  };

  useEffect(() => {
    (async () => {
      try {
        const a = await checkAdmin();
        if (!a.admin) { setData({ forbidden: true }); return; }
        await refresh();
      } finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (data?.forbidden) return <div className="p-8 text-center">Acces interzis.</div>;
  if (!data) return null;

  const { profile, campaigns, leads, tickets, whatsapp } = data;

  const handleSavePlan = async (plan: string, status: string) => {
    setSavingPlan(true);
    try {
      await updatePlan({ data: { user_id: id, plan, subscription_status: status as any } });
      await refresh();
    } finally { setSavingPlan(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Înapoi la utilizatori
      </Link>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold">{profile.full_name || "—"}</h1>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <p className="text-xs text-muted-foreground mt-1">Creat: {new Date(profile.created_at).toLocaleString("ro-RO")}</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={profile.plan}
              onChange={(e) => handleSavePlan(e.target.value, profile.subscription_status)}
              className="h-9 rounded-md border border-border bg-secondary/40 text-sm px-2"
              disabled={savingPlan}
            >
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="premium">Premium</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <select
              value={profile.subscription_status}
              onChange={(e) => handleSavePlan(profile.plan, e.target.value)}
              className="h-9 rounded-md border border-border bg-secondary/40 text-sm px-2"
              disabled={savingPlan}
            >
              <option value="trial">Trial</option>
              <option value="active">Activ</option>
              <option value="past_due">Restant</option>
              <option value="canceled">Anulat</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <Stat label="Campanii" value={campaigns.length} />
          <Stat label="Total cheltuit" value={`${campaigns.reduce((s: number, c: any) => s + Number(c.spend ?? 0), 0).toFixed(2)} lei`} />
          <Stat label="Lead-uri" value={leads.length} />
          <Stat label="WhatsApp" value={whatsapp?.status === "active" ? "Conectat ✅" : "—"} />
        </div>
      </div>

      {/* Campaigns */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Campanii ({campaigns.length})</h2>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-left">
                <th className="px-3 py-2">Nume</th>
                <th className="px-3 py-2">Platformă</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Buget</th>
                <th className="px-3 py-2">Cheltuit</th>
                <th className="px-3 py-2">Click-uri</th>
                <th className="px-3 py-2">Lead-uri</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c: any) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 capitalize">{c.platform}</td>
                  <td className="px-3 py-2">{c.status}</td>
                  <td className="px-3 py-2">{Number(c.budget).toFixed(2)} lei</td>
                  <td className="px-3 py-2">{c.spend.toFixed(2)} lei</td>
                  <td className="px-3 py-2">{c.clicks}</td>
                  <td className="px-3 py-2">{c.leads}</td>
                </tr>
              ))}
              {campaigns.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Nicio campanie încă.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tickets */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Tichete suport ({tickets.length})</h2>
        <div className="space-y-2">
          {tickets.map((t: any) => (
            <Link
              key={t.id}
              to="/admin/tickets/$id"
              params={{ id: t.id }}
              className="block rounded-lg border border-border p-3 hover:bg-secondary/30"
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{t.subject}</div>
                <span className={`px-2 py-0.5 rounded-full text-xs ${t.status === "open" ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground"}`}>
                  {t.status === "open" ? "deschis" : "închis"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{new Date(t.last_message_at).toLocaleString("ro-RO")}</div>
            </Link>
          ))}
          {tickets.length === 0 && <p className="text-sm text-muted-foreground">Niciun tichet.</p>}
        </div>
      </section>

      {/* Recent leads */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Ultimele lead-uri ({leads.length})</h2>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-left">
                <th className="px-3 py-2">Nume</th>
                <th className="px-3 py-2">Telefon</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Dată</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l: any) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-2">{l.full_name || "—"}</td>
                  <td className="px-3 py-2">{l.phone || "—"}</td>
                  <td className="px-3 py-2">{l.email || "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("ro-RO")}</td>
                </tr>
              ))}
              {leads.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Niciun lead.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}