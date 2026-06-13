import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getTicketThread, adminReplyTicket, setTicketStatus, isAdmin } from "@/lib/admin.functions";
import { ArrowLeft, Loader2, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/tickets/$id")({
  component: TicketPage,
});

function TicketPage() {
  const { id } = Route.useParams();
  const checkAdmin = useServerFn(isAdmin);
  const load = useServerFn(getTicketThread);
  const reply = useServerFn(adminReplyTicket);
  const toggle = useServerFn(setTicketStatus);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    const r = await load({ data: { ticket_id: id } });
    setData(r);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
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

  const send = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      const r = await reply({ data: { ticket_id: id, body: body.trim() } });
      setBody("");
      await refresh();
      if (!r.sent_to_whatsapp) {
        // small notice
        console.warn("Mesajul a fost salvat dar nu s-a putut trimite pe WhatsApp (user neconectat).");
      }
    } catch (e: any) {
      alert(e.message || "Eroare la trimitere");
    } finally { setSending(false); }
  };

  const toggleStatus = async () => {
    if (!data?.ticket) return;
    const next = data.ticket.status === "open" ? "closed" : "open";
    await toggle({ data: { ticket_id: id, status: next } });
    await refresh();
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (data?.forbidden) return <div className="p-8 text-center">Acces interzis.</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 flex flex-col h-[calc(100vh-8rem)]">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="w-4 h-4" /> Înapoi
      </Link>

      <div className="rounded-xl border border-border bg-card p-4 mb-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold">{data.ticket.subject}</h1>
          <p className="text-xs text-muted-foreground">de la {data.user_name || data.ticket.user_id.slice(0, 8)}</p>
        </div>
        <button
          onClick={toggleStatus}
          className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-secondary"
        >
          {data.ticket.status === "open" ? "Închide tichetul" : "Redeschide"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-4 space-y-3">
        {data.messages.map((m: any) => (
          <div key={m.id} className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.sender === "admin" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
              <div className="whitespace-pre-wrap break-words">{m.body}</div>
              <div className={`text-[10px] mt-1 opacity-70 flex gap-2 ${m.sender === "admin" ? "justify-end" : ""}`}>
                <span>{new Date(m.created_at).toLocaleString("ro-RO")}</span>
                {m.sender === "admin" && m.sent_to_whatsapp && <span>📱 WhatsApp</span>}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Scrie răspunsul tău…"
          rows={2}
          className="flex-1 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm resize-none"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
        />
        <button
          onClick={send}
          disabled={sending || !body.trim()}
          className="px-4 rounded-xl text-white disabled:opacity-50 flex items-center gap-2"
          style={{ background: "var(--gradient-primary)" }}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Trimite
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">Răspunsul ajunge și pe WhatsApp-ul clientului dacă e conectat.</p>
    </div>
  );
}