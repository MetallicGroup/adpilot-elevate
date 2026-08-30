import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getAdminUserDetail,
  setUserPlan,
  isAdmin,
  updateUserAdmin,
  getUserWhatsAppConversation,
  adminSendWhatsApp,
} from "@/lib/admin.functions";
import { ArrowLeft, Loader2, Send, MessageSquare, Save, Ban, UserCheck, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users/$id")({
  component: UserDetailPage,
});

function UserDetailPage() {
  const { id } = Route.useParams();
  const checkAdmin = useServerFn(isAdmin);
  const load = useServerFn(getAdminUserDetail);
  const updatePlan = useServerFn(setUserPlan);
  const updateAdmin = useServerFn(updateUserAdmin);
  const loadConv = useServerFn(getUserWhatsAppConversation);
  const sendWA = useServerFn(adminSendWhatsApp);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [extendDays, setExtendDays] = useState(7);

  const [conv, setConv] = useState<any[]>([]);
  const [waBody, setWaBody] = useState("");
  const [waBusy, setWaBusy] = useState(false);

  const refresh = async () => {
    const r = await load({ data: { user_id: id } });
    setData(r);
    setNotes(r.profile.admin_notes ?? "");
    if (r.whatsapp?.status === "active") {
      const c = await loadConv({ data: { user_id: id, limit: 100 } });
      setConv(c.messages);
    }
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

  const savePlan = async (plan: string, status: string) => {
    setBusy(true);
    try { await updatePlan({ data: { user_id: id, plan, subscription_status: status as any } }); await refresh(); }
    finally { setBusy(false); }
  };

  const saveNotes = async () => {
    setBusy(true);
    try { await updateAdmin({ data: { user_id: id, admin_notes: notes } }); }
    finally { setBusy(false); }
  };

  const toggleSuspend = async () => {
    if (!confirm(profile.suspended ? "Reactivezi contul?" : "Suspendezi contul? Userul nu va mai putea folosi aplicația.")) return;
    setBusy(true);
    try { await updateAdmin({ data: { user_id: id, suspended: !profile.suspended } }); await refresh(); }
    finally { setBusy(false); }
  };

  const extendTrial = async () => {
    setBusy(true);
    try { await updateAdmin({ data: { user_id: id, extend_trial_days: extendDays } }); await refresh(); }
    finally { setBusy(false); }
  };

  const sendMessage = async () => {
    if (!waBody.trim()) return;
    setWaBusy(true);
    try {
      await sendWA({ data: { user_id: id, body: waBody.trim() } });
      setWaBody("");
      const c = await loadConv({ data: { user_id: id, limit: 100 } });
      setConv(c.messages);
    } catch (e: any) { alert(e.message); }
    finally { setWaBusy(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Înapoi
      </Link>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{profile.full_name || "—"}</h1>
              {profile.suspended && <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-500">SUSPENDAT</span>}
            </div>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Creat: {new Date(profile.created_at).toLocaleString("ro-RO")}
              {profile.trial_ends_at && ` · Trial până: ${new Date(profile.trial_ends_at).toLocaleDateString("ro-RO")}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={profile.plan} onChange={(e) => savePlan(e.target.value, profile.subscription_status)} className="h-9 rounded-md border border-border bg-secondary/40 text-sm px-2" disabled={busy}>
              <option value="starter">Starter</option><option value="pro">Pro</option><option value="premium">Premium</option><option value="enterprise">Enterprise</option>
            </select>
            <select value={profile.subscription_status} onChange={(e) => savePlan(profile.plan, e.target.value)} className="h-9 rounded-md border border-border bg-secondary/40 text-sm px-2" disabled={busy}>
              <option value="trial">Trial</option><option value="active">Activ</option><option value="past_due">Restant</option><option value="canceled">Anulat</option>
            </select>
            <button onClick={toggleSuspend} disabled={busy} className={`h-9 px-3 rounded-md text-sm inline-flex items-center gap-1 ${profile.suspended ? "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25" : "bg-red-500/15 text-red-500 hover:bg-red-500/25"}`}>
              {profile.suspended ? <><UserCheck className="w-4 h-4" />Reactivează</> : <><Ban className="w-4 h-4" />Suspendă</>}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <Stat label="Campanii" value={campaigns.length} />
          <Stat label="Total cheltuit" value={`${campaigns.reduce((s: number, c: any) => s + Number(c.spend ?? 0), 0).toFixed(2)} lei`} />
          <Stat label="Lead-uri" value={leads.length} />
          <Stat label="WhatsApp" value={whatsapp?.status === "active" ? "Conectat ✅" : "—"} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Admin notes */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-sm">Note interne (doar admin)</h3>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm resize-none" placeholder="Note despre acest client…" />
          <button onClick={saveNotes} disabled={busy} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary inline-flex items-center gap-1">
            <Save className="w-3 h-3" /> Salvează note
          </button>
        </div>

        {/* Extend trial */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2"><Calendar className="w-4 h-4" />Prelungește trial</h3>
          <div className="flex items-center gap-2">
            <input type="number" value={extendDays} onChange={(e) => setExtendDays(Number(e.target.value))} min={1} max={365} className="h-9 w-20 rounded-md border border-border bg-secondary/40 px-2 text-sm" />
            <span className="text-sm">zile</span>
            <button onClick={extendTrial} disabled={busy} className="ml-auto text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary">
              Prelungește
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Trial actual până: {profile.trial_ends_at ? new Date(profile.trial_ends_at).toLocaleDateString("ro-RO") : "—"}</p>
        </div>
      </div>

      {/* WhatsApp conversation */}
      {whatsapp?.status === "active" && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4" />Conversație WhatsApp ({conv.length} mesaje)</h3>
          <div className="max-h-96 overflow-y-auto space-y-2 p-3 rounded-lg bg-secondary/30">
            {conv.map((m) => (
              <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.direction === "out" ? "bg-primary text-primary-foreground" : "bg-background border border-border"}`}>
                  <div className="whitespace-pre-wrap break-words">{m.text || `[${m.msg_type}]`}</div>
                  <div className="text-[10px] mt-1 opacity-70">{new Date(m.created_at).toLocaleString("ro-RO")}</div>
                </div>
              </div>
            ))}
            {conv.length === 0 && <p className="text-xs text-center text-muted-foreground py-6">Nicio conversație încă.</p>}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={waBody} onChange={(e) => setWaBody(e.target.value)} placeholder="Trimite mesaj ca AdPilot…" className="flex-1 h-10 rounded-md border border-border bg-secondary/40 px-3 text-sm" onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }} />
            <button onClick={sendMessage} disabled={waBusy || !waBody.trim()} className="px-4 rounded-md text-white disabled:opacity-50 inline-flex items-center gap-2" style={{ background: "var(--gradient-primary)" }}>
              {waBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Trimite
            </button>
          </div>
        </section>
      )}

      {/* Campaigns */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Campanii ({campaigns.length})</h2>
        {campaigns.length === 0 && (
          <div className="rounded-xl border border-border p-6 text-center text-muted-foreground text-sm">Nicio campanie.</div>
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          {campaigns.map((c: any) => (
            <CampaignCard key={c.id} c={c} />
          ))}
        </div>
      </section>

      {/* Tickets */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Tichete suport ({tickets.length})</h2>
        <div className="space-y-2">
          {tickets.map((t: any) => (
            <Link key={t.id} to="/admin/tickets/$id" params={{ id: t.id }} className="block rounded-lg border border-border p-3 hover:bg-secondary/30">
              <div className="flex items-center justify-between">
                <div className="font-medium">{t.subject}</div>
                <span className={`px-2 py-0.5 rounded-full text-xs ${t.status === "open" ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground"}`}>{t.status === "open" ? "deschis" : "închis"}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{new Date(t.last_message_at).toLocaleString("ro-RO")}</div>
            </Link>
          ))}
          {tickets.length === 0 && <p className="text-sm text-muted-foreground">Niciun tichet.</p>}
        </div>
      </section>

      {/* Leads */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Ultimele lead-uri ({leads.length})</h2>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40"><tr className="text-left">
              <th className="px-3 py-2">Nume</th><th className="px-3 py-2">Telefon</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Dată</th>
            </tr></thead>
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

const OBJECTIVE_LABELS: Record<string, string> = {
  leads: "Lead-uri", OUTCOME_LEADS: "Lead-uri",
  sales: "Vânzări", OUTCOME_SALES: "Vânzări",
  traffic: "Trafic", OUTCOME_TRAFFIC: "Trafic",
  calls: "Apeluri", signups: "Înregistrări",
  awareness: "Notorietate", OUTCOME_AWARENESS: "Notorietate",
  engagement: "Interacțiune", OUTCOME_ENGAGEMENT: "Interacțiune",
};

function CampaignCard({ c }: { c: any }) {
  const cr = c.creative && typeof c.creative === "object" ? c.creative : null;
  const tg = c.targeting && typeof c.targeting === "object" ? c.targeting : null;
  const lf = c.lead_form && typeof c.lead_form === "object" ? c.lead_form : null;
  const objLabel = OBJECTIVE_LABELS[c.objective] ?? c.objective ?? "—";
  const statusColor =
    c.status === "active" ? "bg-emerald-500/15 text-emerald-500"
    : c.status === "paused" ? "bg-amber-500/15 text-amber-500"
    : "bg-secondary text-muted-foreground";
  const isVideo = typeof cr?.media_url === "string" && /\.(mp4|mov|webm)(\?|$)/i.test(cr.media_url);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-3 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold truncate">{c.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">
              {c.platform} · Obiectiv: <span className="text-foreground font-medium">{objLabel}</span>
            </p>
          </div>
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs ${statusColor}`}>{c.status}</span>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-3 text-center">
          <div><p className="text-[10px] text-muted-foreground">Cheltuit</p><p className="text-sm font-semibold">{Number(c.spend ?? 0).toFixed(2)} lei</p></div>
          <div><p className="text-[10px] text-muted-foreground">Afișări</p><p className="text-sm font-semibold">{Number(c.impressions ?? 0).toLocaleString("ro-RO")}</p></div>
          <div><p className="text-[10px] text-muted-foreground">Click-uri</p><p className="text-sm font-semibold">{c.clicks ?? 0}</p></div>
          <div><p className="text-[10px] text-muted-foreground">Lead-uri</p><p className="text-sm font-semibold text-primary">{c.leads ?? 0}</p></div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Buget: {Number(c.budget ?? 0).toFixed(2)} lei{c.budget_mode ? ` (${c.budget_mode})` : ""}
          {c.meta_campaign_id ? " · publicată pe Meta" : ""}
        </p>
      </div>

      {/* Preview reclamă (creative) */}
      {cr ? (
        <div className="p-3">
          <p className="text-[11px] font-medium text-muted-foreground mb-2">Reclama (preview)</p>
          <div className="rounded-lg border border-border overflow-hidden max-w-[340px]">
            {cr.primary_text && <p className="px-3 pt-3 pb-2 text-sm whitespace-pre-wrap">{cr.primary_text}</p>}
            {cr.media_url && (
              isVideo ? (
                <video src={cr.media_url} controls className="w-full max-h-[260px] object-cover bg-black" />
              ) : (
                <img src={cr.media_url} alt="" className="w-full max-h-[260px] object-cover" loading="lazy" />
              )
            )}
            {(cr.headline || cr.description || cr.cta) && (
              <div className="flex items-center justify-between gap-2 bg-secondary/40 px-3 py-2">
                <div className="min-w-0">
                  {cr.landing_url && <p className="text-[10px] uppercase text-muted-foreground truncate">{safeHost(cr.landing_url)}</p>}
                  {cr.headline && <p className="text-sm font-semibold truncate">{cr.headline}</p>}
                  {cr.description && <p className="text-xs text-muted-foreground truncate">{cr.description}</p>}
                </div>
                {cr.cta && <span className="shrink-0 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium">{prettyCta(cr.cta)}</span>}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="p-3 text-xs text-muted-foreground">Fără creative salvat pentru această campanie.</p>
      )}

      {/* Targetare + formular de lead */}
      {(tg || lf) && (
        <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2">
          {tg && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">🎯 Targetare</p>
              <ul className="space-y-1 text-xs">
                {tg.locations?.length ? (
                  <li><span className="text-muted-foreground">Locații:</span> {tg.locations.join(", ")}</li>
                ) : null}
                {tg.age_groups?.length ? (
                  <li><span className="text-muted-foreground">Vârstă:</span> {tg.age_groups.join(", ")}</li>
                ) : null}
                {tg.genders?.length ? (
                  <li><span className="text-muted-foreground">Gen:</span> {tg.genders.join(", ")}</li>
                ) : null}
                {tg.interests?.length ? (
                  <li><span className="text-muted-foreground">Interese:</span> {tg.interests.join(", ")}</li>
                ) : null}
              </ul>
            </div>
          )}
          {lf && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">📝 Formular lead</p>
              <ul className="space-y-1 text-xs">
                {lf.fields?.length ? (
                  <li><span className="text-muted-foreground">Câmpuri:</span> {lf.fields.join(", ")}</li>
                ) : null}
                {(lf.custom_questions ?? []).map((q: any, i: number) => (
                  <li key={i}>
                    <span className="text-muted-foreground">Q:</span> {q.label}
                    {q.options?.length ? (
                      <span className="text-muted-foreground"> ({q.options.join(" / ")})</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function safeHost(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return url; }
}
function prettyCta(cta: string): string {
  return String(cta).replace(/_/g, " ").toLowerCase().replace(/^\w/, (m) => m.toUpperCase());
}