import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Facebook, RefreshCw, Trash2, CheckCircle2 } from "lucide-react";
import { resyncMetaConnection, selectMetaAdAccount, selectMetaPage } from "@/lib/meta.functions";
import {
  getWhatsAppConnection,
  saveWhatsAppConnection,
  disconnectWhatsApp,
  sendWhatsAppTest,
} from "@/lib/whatsapp.functions";
import { MessageCircle, Copy } from "lucide-react";

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
      toast.success("Meta account connected");
      navigate({ to: "/settings", replace: true, search: {} as MetaSearch });
    } else if (search.meta === "error") {
      const reason =
        search.reason === "pages_manage_ads_missing"
          ? "Meta did not grant pages_manage_ads. Add yourself as app tester/admin or submit the Meta app for App Review, then reconnect."
          : search.reason;
      toast.error(`Could not connect Meta${reason ? `: ${reason}` : ""}`);
      navigate({ to: "/settings", replace: true, search: {} as MetaSearch });
    }
  }, [search.meta, search.reason, navigate]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="max-w-md mx-auto px-5 pt-10 space-y-6">
      <h1 className="font-serif text-3xl font-semibold">Settings</h1>

      <div className="card-floating p-5">
        <p className="text-xs text-muted-foreground">Plan</p>
        <p className="mt-1 font-semibold">Starter · $49/mo</p>
        <p className="mt-2 text-xs text-muted-foreground">Stripe billing portal coming soon.</p>
      </div>

      <div className="card-floating p-5">
        <p className="text-xs text-muted-foreground">TikTok ad accounts</p>
        <p className="mt-1 text-sm">No accounts connected yet.</p>
      </div>

      <MetaConnectionCard />

      <WhatsAppConnectionCard />

      <button
        onClick={signOut}
        className="press w-full py-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary"
      >
        Sign out
      </button>
    </div>
  );
}

function WhatsAppConnectionCard() {
  const get = useServerFn(getWhatsAppConnection);
  const save = useServerFn(saveWhatsAppConnection);
  const disconnect = useServerFn(disconnectWhatsApp);
  const sendTest = useServerFn(sendWhatsAppTest);

  const { data: conn, isLoading, refetch } = useQuery({
    queryKey: ["wa-connection"],
    queryFn: () => get(),
  });

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const webhookUrl = `${typeof window !== "undefined" ? window.location.origin : "https://adpilot.ro"}/api/public/whatsapp/webhook`;

  async function handleSave() {
    setBusy(true);
    try {
      await save({
        data: {
          phone_number_id: phoneNumberId.trim(),
          waba_id: wabaId.trim() || undefined,
          display_phone: displayPhone.trim() || undefined,
          access_token: accessToken.trim(),
        },
      });
      toast.success("WhatsApp conectat");
      setPhoneNumberId("");
      setWabaId("");
      setDisplayPhone("");
      setAccessToken("");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Eroare salvare");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Deconectezi WhatsApp?")) return;
    await disconnect({});
    toast.success("Deconectat");
    refetch();
  }

  async function handleTest() {
    if (!testPhone) return toast.error("Pune un număr (ex 40712345678)");
    setBusy(true);
    try {
      await sendTest({ data: { to_phone: testPhone } });
      toast.success("Mesaj trimis ✅");
    } catch (e: any) {
      toast.error(e?.message ?? "Eroare trimitere");
    } finally {
      setBusy(false);
    }
  }

  function copyToClipboard(s: string, label: string) {
    navigator.clipboard.writeText(s);
    toast.success(`${label} copiat`);
  }

  return (
    <div className="card-floating p-5">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-[#25D366]" />
        <p className="text-xs text-muted-foreground">WhatsApp Business + AI</p>
      </div>

      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : conn ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <p className="font-medium text-sm">{conn.display_phone ?? conn.phone_number_id}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Phone ID {conn.phone_number_id}</p>
            {conn.last_message_at && (
              <p className="text-xs text-muted-foreground mt-1">
                Ultimul mesaj: {new Date(conn.last_message_at).toLocaleString("ro-RO")}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border p-3 space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Trimite test</p>
            <input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="40712345678 (cu prefix țară)"
              className="w-full px-3 py-2 rounded-lg border border-border text-sm"
            />
            <button
              onClick={handleTest}
              disabled={busy}
              className="press w-full py-2 rounded-lg bg-[#25D366] text-white text-sm font-medium disabled:opacity-60"
            >
              {busy ? "Trimit…" : "Trimite mesaj de bun-venit"}
            </button>
          </div>

          <button
            onClick={handleDisconnect}
            className="press w-full py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary text-destructive"
          >
            Deconectează WhatsApp
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm">
            Conectează-ți numărul WhatsApp Business ca să primești lead-uri și să comanzi
            campaniile prin chat cu AI.
          </p>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer text-foreground font-medium">
              Pași în Meta Business Manager
            </summary>
            <ol className="list-decimal ml-4 mt-2 space-y-1">
              <li>Mergi la business.facebook.com → WhatsApp → API Setup</li>
              <li>Copiază <b>Phone number ID</b> și <b>WhatsApp Business Account ID</b></li>
              <li>Generează un <b>Permanent access token</b> (System User → assign WABA → token cu <code>whatsapp_business_messaging</code>)</li>
              <li>În <b>Configuration → Webhook</b>: lipește URL-ul și verify-token-ul de mai jos după ce salvezi</li>
              <li>Subscribe la field <b>messages</b></li>
            </ol>
          </details>

          <input
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="Phone Number ID (ex 102290129340398)"
            className="w-full px-3 py-2 rounded-lg border border-border text-sm"
          />
          <input
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value)}
            placeholder="WABA ID (opțional)"
            className="w-full px-3 py-2 rounded-lg border border-border text-sm"
          />
          <input
            value={displayPhone}
            onChange={(e) => setDisplayPhone(e.target.value)}
            placeholder="Număr afișaj ex +40 712 345 678 (opțional)"
            className="w-full px-3 py-2 rounded-lg border border-border text-sm"
          />
          <textarea
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Permanent access token"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-border text-sm font-mono"
          />
          <button
            onClick={handleSave}
            disabled={busy || !phoneNumberId || !accessToken}
            className="press w-full py-3 rounded-xl bg-[#25D366] text-white text-sm font-medium disabled:opacity-60"
          >
            {busy ? "Salvez…" : "Conectează WhatsApp"}
          </button>

          <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Webhook URL</span>
              <button
                onClick={() => copyToClipboard(webhookUrl, "URL")}
                className="press flex items-center gap-1 text-foreground"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <code className="block break-all text-foreground">{webhookUrl}</code>
            <p className="text-muted-foreground">
              Verify token-ul apare aici după ce salvezi conexiunea.
            </p>
          </div>
        </div>
      )}
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
      toast.error("Not signed in");
      setBusy(false);
      return;
    }
    window.location.href = `/api/meta/auth/start?uid=${u.user.id}`;
  }

  async function disconnect(id: string) {
    if (!confirm("Disconnect this Meta account?")) return;
    const { error } = await supabase.from("meta_connections").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Disconnected");
    refetch();
  }

  async function handleResync(connectionId: string) {
    try {
      const res = await resync({ data: { connectionId } });
      toast.success(`Synced ${res.adAccounts} ad accounts, ${res.pages} pages`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Sync failed");
    }
  }

  async function selectAdAccount(connectionId: string, adAccountRowId: string) {
    try {
      await selectAd({ data: { connectionId, rowId: adAccountRowId } });
      toast.success("Ad account selected");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save ad account");
    }
  }

  async function selectPage(connectionId: string, pageRowId: string) {
    try {
      await selectPg({ data: { connectionId, rowId: pageRowId } });
      toast.success("Page selected");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save page");
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
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : connections.length === 0 ? (
        <>
          <p className="mt-1 text-sm">No Meta account connected yet.</p>
          <button
            onClick={connect}
            disabled={busy}
            className="press mt-4 w-full py-3 rounded-xl bg-[#1877F2] text-white text-sm font-medium hover:bg-[#1666d4] disabled:opacity-60"
          >
            {busy ? "Redirecting…" : "Connect Meta Account"}
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
                    title="Resync"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => disconnect(c.id)}
                    className="press p-2 rounded-lg hover:bg-secondary text-destructive"
                    title="Disconnect"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Ad accounts ({c.ad_accounts.length})
                </p>
                {c.ad_accounts.length === 0 ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-muted-foreground">None found.</p>
                    <button
                      onClick={() => handleResync(c.id)}
                      className="press w-full py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary"
                    >
                      Sync ad accounts
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
                  Pages ({c.pages.length})
                </p>
                {c.pages.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    No Facebook Pages found. Lead Ads require a Page linked to your
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
            Connect another Meta account
          </button>
        </div>
      )}
    </div>
  );
}