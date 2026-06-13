import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyTickets, createTicket, getMyTicket, addMyMessage } from "@/lib/support.functions";
import { Loader2, Plus, Send, ArrowLeft, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/support")({
  component: SupportPage,
});

function SupportPage() {
  const listFn = useServerFn(listMyTickets);
  const createFn = useServerFn(createTicket);
  const getFn = useServerFn(getMyTicket);
  const addFn = useServerFn(addMyMessage);

  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    const r = await listFn();
    setTickets(r.tickets);
  };

  useEffect(() => {
    (async () => { try { await refresh(); } finally { setLoading(false); } })();
  }, []);

  const openTicket = async (id: string) => {
    setOpenId(id);
    const r = await getFn({ data: { ticket_id: id } });
    setThread(r);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const submitNew = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      const r = await createFn({ data: { subject: subject.trim(), body: body.trim() } });
      setSubject(""); setBody(""); setShowNew(false);
      await refresh();
      await openTicket(r.ticket.id);
    } catch (e: any) { alert(e.message); } finally { setSending(false); }
  };

  const sendReply = async () => {
    if (!reply.trim() || !openId) return;
    setSending(true);
    try {
      await addFn({ data: { ticket_id: openId, body: reply.trim() } });
      setReply("");
      await openTicket(openId);
    } finally { setSending(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (openId && thread) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 flex flex-col h-[calc(100vh-8rem)]">
        <button onClick={() => { setOpenId(null); setThread(null); refresh(); }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Înapoi la tichete
        </button>
        <div className="rounded-xl border border-border bg-card p-4 mb-3">
          <h1 className="font-bold">{thread.ticket.subject}</h1>
          <p className="text-xs text-muted-foreground">Status: {thread.ticket.status === "open" ? "deschis" : "închis"}</p>
        </div>
        <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-4 space-y-3">
          {thread.messages.map((m: any) => (
            <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.sender === "user" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className="text-[10px] mt-1 opacity-70">{new Date(m.created_at).toLocaleString("ro-RO")}</div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="mt-3 flex gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Scrie un mesaj…"
            rows={2}
            className="flex-1 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm resize-none"
          />
          <button onClick={sendReply} disabled={sending || !reply.trim()} className="px-4 rounded-xl text-white disabled:opacity-50 flex items-center gap-2" style={{ background: "var(--gradient-primary)" }}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Trimite
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Suport</h1>
          <p className="text-sm text-muted-foreground">Întreabă orice — echipa AdPilot îți răspunde aici și pe WhatsApp.</p>
        </div>
        <button onClick={() => setShowNew((v) => !v)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm" style={{ background: "var(--gradient-primary)" }}>
          <Plus className="w-4 h-4" /> Tichet nou
        </button>
      </div>

      {showNew && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subiect (ex: Nu îmi pornește campania)" className="w-full h-10 rounded-md border border-border bg-secondary/40 px-3 text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Descrie problema…" rows={4} className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNew(false)} className="px-3 py-1.5 text-sm rounded-md border border-border">Anulează</button>
            <button onClick={submitNew} disabled={sending || !subject.trim() || !body.trim()} className="px-3 py-1.5 text-sm rounded-md text-white disabled:opacity-50" style={{ background: "var(--gradient-primary)" }}>
              {sending ? "Se trimite…" : "Trimite tichet"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {tickets.length === 0 && !showNew && (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
            Niciun tichet încă. Apasă „Tichet nou" dacă ai nevoie de ajutor.
          </div>
        )}
        {tickets.map((t) => (
          <button key={t.id} onClick={() => openTicket(t.id)} className="w-full text-left rounded-lg border border-border p-3 hover:bg-secondary/30">
            <div className="flex items-center justify-between">
              <div className="font-medium">{t.subject}</div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${t.status === "open" ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground"}`}>
                {t.status === "open" ? "deschis" : "închis"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">{new Date(t.last_message_at).toLocaleString("ro-RO")}</div>
          </button>
        ))}
      </div>
    </div>
  );
}