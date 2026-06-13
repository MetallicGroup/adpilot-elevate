import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Facebook, RefreshCw, Trash2, CheckCircle2 } from "lucide-react";
import { resyncMetaConnection, selectMetaAdAccount, selectMetaPage } from "@/lib/meta.functions";
import { WhatsAppConnectionCard } from "@/components/whatsapp/WhatsAppConnectionCard";

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
    <div className="max-w-md mx-auto px-5 pt-10 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Cont</p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Setări ⚙️</h1>
      </div>

      <div className="card-floating p-5">
        <p className="text-xs text-muted-foreground">Plan</p>
        <p className="mt-1 font-semibold">Starter · $49/mo</p>
        <p className="mt-2 text-xs text-muted-foreground">Portal de facturare Stripe — în curând.</p>
      </div>

      <div className="card-floating p-5">
        <p className="text-xs text-muted-foreground">Conturi TikTok Ads</p>
        <p className="mt-1 text-sm">Niciun cont conectat încă.</p>
      </div>

      <MetaConnectionCard />

      <WhatsAppConnectionCard />

      <button
        onClick={signOut}
        className="press w-full py-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary"
      >
        Deconectare
      </button>
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