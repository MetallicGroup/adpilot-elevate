import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Facebook, RefreshCw, Trash2, CheckCircle2, User, Plug, Palette, Plus, Music2 } from "lucide-react";
import { resyncMetaConnection, selectMetaAdAccount, selectMetaPage } from "@/lib/meta.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { applyAccent } from "@/components/AppHeader";
import { SubscriptionBadge } from "@/components/SubscriptionBadge";
import { BillingHistory } from "@/components/BillingHistory";

type MetaSearch = { meta?: string; reason?: string };

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (s: Record<string, unknown>): MetaSearch => ({
    meta: typeof s.meta === "string" ? s.meta : undefined,
    reason: typeof s.reason === "string" ? s.reason : undefined,
  }),
  component: Settings,
});

function Settings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const search = useSearch({ from: "/_authenticated/settings" });

  useEffect(() => {
    if (search.meta === "connected") {
      toast.success("Cont Meta conectat ✅");
      navigate({ to: "/settings", replace: true, search: {} as MetaSearch });
    } else if (search.meta === "error") {
      const reason =
        search.reason === "pages_manage_ads_missing"
          ? "Meta nu a acordat pages_manage_ads. Adaugă-te ca tester/admin sau trimite aplicația în review, apoi reconectează."
          : search.reason;
      toast.error(`Nu am putut conecta Meta${reason ? `: ${reason}` : ""}`);
      navigate({ to: "/settings", replace: true, search: {} as MetaSearch });
    }
  }, [search.meta, search.reason, navigate]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Te-ai deconectat 👋");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="max-w-4xl mx-auto px-5 pt-8 pb-32 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Cont</p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Setări ⚙️</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tot ce ține de cont, integrări, echipă și aspect — într-un loc.</p>
      </div>

      <Tabs defaultValue="cont" className="w-full">
        <TabsList className="bg-secondary/40 p-1 rounded-full h-auto flex flex-wrap gap-1 justify-start w-full">
          <TabTrig value="cont" icon={<User className="w-3.5 h-3.5" />}>Cont</TabTrig>
          <TabTrig value="integrari" icon={<Plug className="w-3.5 h-3.5" />}>Integrări</TabTrig>
          <TabTrig value="aspect" icon={<Palette className="w-3.5 h-3.5" />}>Aspect</TabTrig>
        </TabsList>

        <TabsContent value="cont" className="mt-6 space-y-4">
          <Card title="Plan & facturare" subtitle="Abonamentul tău activ, perioada de trial și data următoarei facturări.">
            <SubscriptionBadge />
          </Card>

          <Card title="Facturi & chitanțe" subtitle="Istoric Stripe și următoarea facturare.">
            <BillingHistory />
          </Card>

          <Card title="Profil" subtitle="Datele tale de afișare în AdPilot.">
            <div className="space-y-3">
              <Row label="Nume afișat" defaultValue="Cont AdPilot" />
              <Row label="Email" defaultValue="tu@adpilot.ro" disabled />
              <Row label="Telefon" defaultValue="+40 722 123 456" />
            </div>
            <button className="press mt-4 text-sm px-4 py-2 rounded-lg bg-foreground text-background">Salvează</button>
          </Card>

          <button
            onClick={signOut}
            className="press w-full py-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary text-destructive"
          >
            Deconectare
          </button>
        </TabsContent>

        <TabsContent value="integrari" className="mt-6 space-y-4">
          <MetaConnectionCard />
        </TabsContent>

        <TabsContent value="aspect" className="mt-6 space-y-4">
          <Card title="Culoare accent" subtitle="Păstrăm dark mode peste tot — tu alegi nuanța accentului.">
            <AccentPicker />
          </Card>
          <Card title="Densitate interfață" subtitle="Cât de aerisită să fie aplicația.">
            <div className="flex gap-2">
              {["Confortabilă", "Standard", "Compactă"].map((d, i) => (
                <button key={d} className={`press flex-1 text-sm py-2 rounded-lg border ${i === 1 ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"}`}>{d}</button>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TabTrig({ value, icon, children }: { value: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className="rounded-full px-3 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow data-[state=active]:text-foreground text-muted-foreground gap-1.5"
    >
      {icon} {children}
    </TabsTrigger>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card-floating p-5">
      <p className="font-semibold text-sm">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Row({ label, defaultValue, disabled }: { label: string; defaultValue: string; disabled?: boolean }) {
  return (
    <label className="flex flex-col sm:flex-row sm:items-center gap-2">
      <span className="text-xs text-muted-foreground w-32">{label}</span>
      <input
        defaultValue={defaultValue}
        disabled={disabled}
        className="flex-1 h-10 px-3 rounded-lg bg-secondary/60 border border-border text-sm outline-none focus:border-primary disabled:opacity-60"
      />
    </label>
  );
}

function AccentPicker() {
  const accents = [
    { hue: "290", label: "Violet" },
    { hue: "250", label: "Albastru" },
    { hue: "155", label: "Verde" },
    { hue: "340", label: "Roz" },
    { hue: "60", label: "Amber" },
    { hue: "20", label: "Coral" },
  ];
  const [active, setActive] = useState<string>(() => (typeof window !== "undefined" && localStorage.getItem("adpilot:accent")) || "290");
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {accents.map((a) => (
        <button
          key={a.hue}
          onClick={() => { setActive(a.hue); localStorage.setItem("adpilot:accent", a.hue); applyAccent(a.hue); toast.success(`Accent: ${a.label}`); }}
          className={`press relative aspect-square rounded-2xl flex flex-col items-center justify-end p-3 border transition-all ${active === a.hue ? "border-foreground scale-105" : "border-border hover:border-muted-foreground"}`}
          style={{ background: `linear-gradient(135deg, oklch(0.62 0.22 ${a.hue}), oklch(0.7 0.2 ${Number(a.hue) + 25}))` }}
        >
          <span className="text-[10px] font-medium text-white drop-shadow">{a.label}</span>
          {active === a.hue && <CheckCircle2 className="absolute top-2 right-2 w-3.5 h-3.5 text-white" />}
        </button>
      ))}
    </div>
  );
}

function MetaConnectionCard() {
  const [busy, setBusy] = useState(false);
  const resync = useServerFn(resyncMetaConnection);
  const selectAd = useServerFn(selectMetaAdAccount);
  const selectPg = useServerFn(selectMetaPage);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["meta-connections"],
    queryFn: async () => {
      const { data: conns, error } = await supabase
        .from("meta_connections")
        .select("id, meta_user_id, meta_user_name, is_active, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (conns ?? []).map((c) => c.id);
      const [{ data: ads }, { data: pages }] = await Promise.all([
        ids.length
          ? supabase
              .from("meta_ad_accounts")
              .select("id, connection_id, ad_account_id, account_name, currency, is_active")
              .in("connection_id", ids)
          : Promise.resolve({ data: [] }),
        ids.length
          ? supabase
              .from("meta_pages")
              .select("id, connection_id, page_id, page_name, is_active")
              .in("connection_id", ids)
          : Promise.resolve({ data: [] }),
      ]);

      return (conns ?? []).map((c) => ({
        ...c,
        ad_accounts: (ads ?? []).filter((a) => a.connection_id === c.id),
        pages: (pages ?? []).filter((p) => p.connection_id === c.id),
      }));
    },
  });

  async function connect() {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast.error("Nu ești autentificat");
      setBusy(false);
      return;
    }
    window.location.href = `/api/meta/auth/start?uid=${u.user.id}`;
  }

  async function disconnect(id: string) {
    if (!confirm("Deconectezi acest cont Meta?")) return;
    const { error } = await supabase.from("meta_connections").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deconectat");
    refetch();
  }

  async function handleResync(connectionId: string) {
    try {
      const res = await resync({ data: { connectionId } });
      toast.success(`Sincronizat: ${res.adAccounts} conturi, ${res.pages} pagini`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Sincronizare eșuată");
    }
  }

  async function selectAdAccount(connectionId: string, adAccountRowId: string) {
    try {
      await selectAd({ data: { connectionId, rowId: adAccountRowId } });
      toast.success("Cont de reclamă selectat");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Nu am putut salva contul");
    }
  }

  async function selectPage(connectionId: string, pageRowId: string) {
    try {
      await selectPg({ data: { connectionId, rowId: pageRowId } });
      toast.success("Pagină selectată");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Nu am putut salva pagina");
    }
  }

  const connections = data ?? [];

  return (
    <div className="card-floating p-5">
      <div className="flex items-center gap-2">
        <Facebook className="w-4 h-4 text-[#1877F2]" />
        <p className="text-xs text-muted-foreground">Meta (Facebook & Instagram) Ads</p>
      </div>

      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Se încarcă…</p>
      ) : connections.length === 0 ? (
        <>
          <p className="mt-1 text-sm">Niciun cont Meta conectat încă.</p>
          <button
            onClick={connect}
            disabled={busy}
            className="press mt-4 w-full py-3 rounded-xl bg-[#1877F2] text-white text-sm font-medium hover:bg-[#1666d4] disabled:opacity-60"
          >
            {busy ? "Redirecționare…" : "Conectează contul Meta"}
          </button>
        </>
      ) : (
        <div className="mt-3 space-y-4">
          {connections.map((c) => (
            <div key={c.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <p className="font-medium text-sm">{c.meta_user_name ?? "Meta user"}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">ID {c.meta_user_id}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleResync(c.id)}
                    className="press p-2 rounded-lg hover:bg-secondary"
                    title="Resincronizează"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => disconnect(c.id)}
                    className="press p-2 rounded-lg hover:bg-secondary text-destructive"
                    title="Deconectează"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Conturi de reclamă ({c.ad_accounts.length})
                </p>
                {c.ad_accounts.length === 0 ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-muted-foreground">Niciun cont găsit.</p>
                    <button
                      onClick={() => handleResync(c.id)}
                      className="press w-full py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary"
                    >
                      Sincronizează conturile
                    </button>
                  </div>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {c.ad_accounts.map((a) => (
                      <li key={a.id}>
                        <label className="flex items-center gap-2 text-xs cursor-pointer py-1">
                          <input
                            type="radio"
                            name={`ad-${c.id}`}
                            checked={!!a.is_active}
                            onChange={() => selectAdAccount(c.id, a.id)}
                          />
                          <span className="flex-1">{a.account_name ?? a.ad_account_id}</span>
                          <span className="text-muted-foreground">{a.currency}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Pagini ({c.pages.length})
                </p>
                {c.pages.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Nicio pagină Facebook găsită. Lead Ads necesită o pagină legată la
                    Business Manager.
                  </p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {c.pages.map((p) => (
                      <li key={p.id}>
                        <label className="flex items-center gap-2 text-xs cursor-pointer py-1">
                          <input
                            type="radio"
                            name={`page-${c.id}`}
                            checked={!!p.is_active}
                            onChange={() => selectPage(c.id, p.id)}
                          />
                          <span className="flex-1">{p.page_name ?? p.page_id}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
          <button
            onClick={connect}
            disabled={busy}
            className="press w-full py-2.5 rounded-xl border border-border text-xs font-medium hover:bg-secondary"
          >
            Conectează alt cont Meta
          </button>
        </div>
      )}
    </div>
  );
}