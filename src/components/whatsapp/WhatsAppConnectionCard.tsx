import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, MessageCircle, ExternalLink } from "lucide-react";
import {
  getMyWhatsApp,
  saveMyWhatsAppPhone,
  disconnectMyWhatsApp,
} from "@/lib/whatsapp.functions";

export function WhatsAppConnectionCard() {
  const get = useServerFn(getMyWhatsApp);
  const save = useServerFn(saveMyWhatsAppPhone);
  const disconnect = useServerFn(disconnectMyWhatsApp);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["wa-me"],
    queryFn: () => get(),
  });

  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!phone.trim()) return toast.error("Introdu numărul tău de telefon");
    setBusy(true);
    try {
      await save({ data: { phone: phone.trim() } });
      toast.success("Număr salvat — apasă „Activează" să trimiți mesajul");
      setPhone("");
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

  const conn = data?.connection ?? null;
  const activationLink = data?.activation_link ?? null;
  const isActive = conn?.status === "active";

  return (
    <div className="card-floating p-5">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-[#25D366]" />
        <p className="text-xs text-muted-foreground">Asistent AdPilot pe WhatsApp 💬</p>
      </div>

      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Se încarcă…</p>
      ) : !conn ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm">
            Primește lead-uri, rapoarte și controlează campaniile direct pe WhatsApp.
            Introdu numărul tău de telefon — asta e tot. ✨
          </p>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+40 712 345 678"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
          <button
            onClick={handleSave}
            disabled={busy || !phone.trim()}
            className="press w-full py-3 rounded-xl bg-[#25D366] text-white text-sm font-medium disabled:opacity-60"
          >
            {busy ? "Salvez…" : "Salvează numărul"}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${isActive ? "text-emerald-500" : "text-amber-500"}`} />
              <p className="font-medium text-sm">+{conn.user_phone}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isActive
                ? `Activ${conn.activated_at ? ` din ${new Date(conn.activated_at).toLocaleDateString("ro-RO")}` : ""}`
                : "În așteptarea activării ⏳"}
            </p>
            {conn.last_message_at && (
              <p className="text-xs text-muted-foreground mt-1">
                Ultimul mesaj: {new Date(conn.last_message_at).toLocaleString("ro-RO")}
              </p>
            )}
          </div>

          {!isActive && activationLink && (
            <>
              <a
                href={activationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="press w-full py-3 rounded-xl bg-[#25D366] text-white text-sm font-medium flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Activează asistentul pe WhatsApp
              </a>
              <p className="text-xs text-muted-foreground text-center">
                Se va deschide WhatsApp cu un mesaj pregătit. Trimite-l ca să primești
                instant un răspuns de bun-venit de la AdPilot.
              </p>
            </>
          )}

          {!isActive && !activationLink && !data?.configured && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300">
              ⏳ Numărul AdPilot e încă în review la Meta. Asistentul va fi activ
              imediat ce e aprobat — fără să faci nimic.
            </div>
          )}

          {isActive && (
            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              Scrie-i botului pe WhatsApp orice:
              <br />• „arată-mi campaniile"
              <br />• „cât am cheltuit săptămâna asta?"
              <br />• „vreau o campanie nouă" (trimite și o poză 📸)
            </div>
          )}

          <button
            onClick={handleDisconnect}
            className="press w-full py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary text-destructive"
          >
            Deconectează WhatsApp
          </button>
        </div>
      )}
    </div>
  );
}