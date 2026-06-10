import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Facebook, Loader2 } from "lucide-react";
import { getMetaAuthUrl, getMetaConnectionStatus } from "@/lib/meta.functions";
import { linkWhatsAppPhone } from "@/lib/leads.functions";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

function Settings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchMetaAuth = useServerFn(getMetaAuthUrl);
  const fetchMetaStatus = useServerFn(getMetaConnectionStatus);
  const saveWhatsApp = useServerFn(linkWhatsAppPhone);
  const [whatsappPhone, setWhatsappPhone] = useState("");

  const [connecting, setConnecting] = useState(false);
  const [metaConnected, setMetaConnected] = useState(false);
  const [metaUserName, setMetaUserName] = useState<string | null>(null);
  const [metaAccounts, setMetaAccounts] = useState<Array<{ account_name: string | null; ad_account_id: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("meta") === "connected") {
      toast.success("Meta account connected");
      window.history.replaceState({}, "", "/settings");
    }
    const err = params.get("meta_error");
    if (err) {
      toast.error(decodeURIComponent(err));
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  useEffect(() => {
    fetchMetaStatus()
      .then((status) => {
        setMetaConnected(status.connected);
        setMetaUserName(status.connection?.meta_user_name ?? null);
        setMetaAccounts(status.ad_accounts ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchMetaStatus]);

  async function connectMeta() {
    setConnecting(true);
    try {
      const { url } = await fetchMetaAuth();
      window.location.href = url;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't connect Meta");
      setConnecting(false);
    }
  }

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

      <div className="card-floating p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">TikTok ad accounts</p>
            <p className="mt-1 text-sm">No accounts connected yet.</p>
          </div>
        </div>
      </div>

      <div className="card-floating p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-meta/10 text-meta flex items-center justify-center">
            <Facebook className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Meta ad accounts</p>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mt-1 text-muted-foreground" />
            ) : metaConnected ? (
              <p className="mt-1 text-sm font-medium">Connected{metaUserName ? ` as ${metaUserName}` : ""}</p>
            ) : (
              <p className="mt-1 text-sm">Not connected</p>
            )}
          </div>
        </div>

        {metaConnected && metaAccounts.length > 0 && (
          <ul className="text-sm space-y-1 text-muted-foreground">
            {metaAccounts.map((a) => (
              <li key={a.ad_account_id}>· {a.account_name ?? a.ad_account_id}</li>
            ))}
          </ul>
        )}

        {!metaConnected && (
          <button
            onClick={connectMeta}
            disabled={connecting}
            className="press w-full py-3 rounded-xl bg-meta text-meta-foreground text-sm font-medium disabled:opacity-50"
          >
            {connecting ? "Redirecting…" : "Connect Meta Account"}
          </button>
        )}
      </div>

      <div className="card-floating p-5 space-y-3">
        <p className="text-xs text-muted-foreground">WhatsApp — notificări lead-uri</p>
        <p className="text-sm text-muted-foreground">Primești mesaj instant când vine un client nou.</p>
        <Input
          value={whatsappPhone}
          onChange={(e) => setWhatsappPhone(e.target.value)}
          placeholder="07xx xxx xxx"
          className="h-12 rounded-xl"
        />
        <button
          onClick={async () => {
            try {
              await saveWhatsApp({ data: { phone: whatsappPhone } });
              toast.success("Număr WhatsApp salvat");
            } catch (e: unknown) {
              toast.error(e instanceof Error ? e.message : "Eroare");
            }
          }}
          className="press w-full py-2.5 rounded-xl border border-border text-sm font-medium"
        >
          Salvează numărul
        </button>
      </div>

      <button onClick={signOut} className="press w-full py-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary">
        Deconectare
      </button>
    </div>
  );
}
