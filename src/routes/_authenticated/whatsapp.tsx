import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, Check, CheckCheck, Sparkles, Search, Settings as SettingsIcon, Zap, Bot } from "lucide-react";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  component: WhatsAppPage,
});

type Msg = { id: string; from: "me" | "them"; text: string; at: string; status?: "sent" | "delivered" | "read" };
type Thread = {
  id: string;
  name: string;
  phone: string;
  hue: number;
  source: "TikTok" | "Meta" | "AdPilot AI";
  unread: number;
  last: string;
  lastAt: string;
  online?: boolean;
  msgs: Msg[];
};

const QUICK_REPLIES = [
  "Mulțumim! Te contactăm în 10 minute. 🙌",
  "Trimite-mi te rog un număr de telefon și te sunăm imediat.",
  "Avem disponibilitate săptămâna asta. Când îți convine? 📅",
  "Îți trimit oferta personalizată pe WhatsApp în câteva minute.",
];

const AI_TEMPLATES = [
  { icon: Bot, label: "Răspuns AI personalizat", hint: "Generează un răspuns pe baza istoricului" },
  { icon: Zap, label: "Programează follow-up", hint: "Reaminteşte-mi peste 2 zile" },
  { icon: Sparkles, label: "Calificare automată", hint: "Întreabă bugetul, timeline-ul, decident" },
];

const INITIAL_THREADS: Thread[] = [
  {
    id: "t1", name: "Andrei Popescu", phone: "+40 722 145 893", hue: 290, source: "TikTok",
    unread: 2, last: "Salut! Am văzut reclama, mai aveți stoc?", lastAt: "acum 2 min", online: true,
    msgs: [
      { id: "m1", from: "them", text: "Salut! Am văzut reclama pe TikTok 🚀", at: "10:02" },
      { id: "m2", from: "them", text: "Mai aveți stoc la oferta cu reducere?", at: "10:02" },
    ],
  },
  {
    id: "t2", name: "Maria Ionescu", phone: "+40 745 332 110", hue: 320, source: "Meta",
    unread: 0, last: "Perfect, mulțumesc pentru răspuns!", lastAt: "acum 14 min",
    msgs: [
      { id: "m1", from: "them", text: "Bună ziua, când e disponibilă livrarea?", at: "09:14" },
      { id: "m2", from: "me", text: "În 24 de ore în București, 48 în țară 📦", at: "09:16", status: "read" },
      { id: "m3", from: "them", text: "Perfect, mulțumesc pentru răspuns!", at: "09:18" },
    ],
  },
  {
    id: "t3", name: "AdPilot AI", phone: "Asistent", hue: 155, source: "AdPilot AI",
    unread: 1, last: '🚀 47 lead-uri azi (+23% vs ieri). Top campanie: „Lansare vară".', lastAt: "acum 1 oră",
    msgs: [
      { id: "m1", from: "me", text: "Câte lead-uri azi?", at: "08:30", status: "read" },
      { id: "m2", from: "them", text: '47 lead-uri azi 📈\n+23% față de ieri\nTop campanie: „Lansare vară" cu 28 lead-uri', at: "08:30" },
      { id: "m3", from: "me", text: "Bugetul cum stă?", at: "08:31", status: "read" },
      { id: "m4", from: "them", text: "€780 cheltuiți din €1200 (zilnic). CPL mediu €6,40 — în target ✅", at: "08:31" },
    ],
  },
  {
    id: "t4", name: "Cristian Vasile", phone: "+40 766 980 221", hue: 250, source: "TikTok",
    unread: 0, last: "Sună-mă te rog după ora 17.", lastAt: "ieri",
    msgs: [
      { id: "m1", from: "them", text: "Sună-mă te rog după ora 17.", at: "16:45" },
    ],
  },
  {
    id: "t5", name: "Elena Dumitrescu", phone: "+40 733 558 904", hue: 60, source: "Meta",
    unread: 0, last: "Mulțumim! Te contactăm în 10 minute. 🙌", lastAt: "marți",
    msgs: [
      { id: "m1", from: "them", text: "Vreau și eu oferta", at: "12:00" },
      { id: "m2", from: "me", text: "Mulțumim! Te contactăm în 10 minute. 🙌", at: "12:01", status: "read" },
    ],
  },
];

function WhatsAppPage() {
  const [threads, setThreads] = useState<Thread[]>(INITIAL_THREADS);
  const [activeId, setActiveId] = useState<string>(INITIAL_THREADS[0].id);
  const [q, setQ] = useState("");
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const active = useMemo(() => threads.find((t) => t.id === activeId)!, [threads, activeId]);
  const filtered = threads.filter((t) =>
    !q.trim() || t.name.toLowerCase().includes(q.toLowerCase()) || t.last.toLowerCase().includes(q.toLowerCase()),
  );

  useEffect(() => {
    if (active.unread > 0) {
      setThreads((prev) => prev.map((t) => (t.id === active.id ? { ...t, unread: 0 } : t)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [active.msgs.length, typing]);

  const send = (text?: string) => {
    const t = (text ?? input).trim();
    if (!t) return;
    const id = Math.random().toString(36).slice(2);
    const now = new Date().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
    setThreads((prev) => prev.map((th) =>
      th.id === active.id
        ? { ...th, last: t, lastAt: "acum", msgs: [...th.msgs, { id, from: "me", text: t, at: now, status: "sent" }] }
        : th,
    ));
    setInput("");
    // simulate delivery + read
    setTimeout(() => updateStatus(id, "delivered"), 600);
    setTimeout(() => updateStatus(id, "read"), 1500);
    // simulate reply when chatting with AI
    if (active.id === "t3") {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        const reply = aiReply(t);
        setThreads((prev) => prev.map((th) =>
          th.id === active.id
            ? { ...th, last: reply, lastAt: "acum", msgs: [...th.msgs, { id: Math.random().toString(36).slice(2), from: "them", text: reply, at: now }] }
            : th,
        ));
      }, 1600);
    }
  };

  const updateStatus = (id: string, status: Msg["status"]) => {
    setThreads((prev) => prev.map((th) =>
      th.id === active.id ? { ...th, msgs: th.msgs.map((m) => (m.id === id ? { ...m, status } : m)) } : th,
    ));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="max-w-6xl mx-auto px-3 md:px-5 pt-6 pb-28"
    >
      <div className="flex items-end justify-between gap-4 mb-5 px-2">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#25D366]/10 border border-[#25D366]/20 text-[10px] font-medium text-[#25D366]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] pulse-dot" /> WhatsApp conectat
          </div>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight">
            Inbox <span className="gradient-text">WhatsApp</span> 💬
          </h1>
        </div>
        <button className="press hidden md:inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground">
          <SettingsIcon className="w-3.5 h-3.5" /> Setări canal
        </button>
      </div>

      <div className="card-floating overflow-hidden grid md:grid-cols-[300px,1fr] h-[72vh] min-h-[520px]">
        {/* Threads list */}
        <aside className="border-r border-border flex flex-col min-h-0">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Caută conversație…"
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-secondary/60 border border-transparent focus:border-border outline-none text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={`w-full text-left px-3 py-3 flex gap-3 items-center border-b border-border/60 transition-colors ${
                  activeId === t.id ? "bg-secondary/60" : "hover:bg-secondary/30"
                }`}
              >
                <Avatar name={t.name} hue={t.hue} online={t.online} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{t.name}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{t.lastAt}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground truncate flex-1">{t.last}</span>
                    {t.unread > 0 && (
                      <span className="ml-auto shrink-0 text-[10px] font-semibold text-white rounded-full px-1.5 py-0.5 min-w-5 text-center" style={{ background: "var(--gradient-primary)" }}>
                        {t.unread}
                      </span>
                    )}
                  </div>
                  <span className="mt-1 inline-block text-[9px] uppercase tracking-wider text-muted-foreground/70">{t.source}</span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground">Nicio conversație. ✨</div>
            )}
          </div>
        </aside>

        {/* Chat */}
        <section className="flex flex-col min-h-0 bg-[oklch(0.13_0.01_285)]/50">
          <header className="px-4 py-3 border-b border-border flex items-center gap-3 bg-background/60 backdrop-blur">
            <Avatar name={active.name} hue={active.hue} online={active.online} />
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{active.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {active.online ? "🟢 online" : active.phone} · prin {active.source}
              </p>
            </div>
          </header>

          <div ref={scroller} className="flex-1 overflow-y-auto p-4 space-y-2">
            {active.msgs.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap shadow-sm ${
                    m.from === "me"
                      ? "rounded-tr-sm text-white"
                      : "rounded-tl-sm bg-secondary text-foreground"
                  }`}
                  style={m.from === "me" ? { background: "var(--gradient-primary)" } : undefined}
                >
                  {m.text}
                  <div className={`mt-1 flex items-center gap-1 text-[10px] ${m.from === "me" ? "text-white/70 justify-end" : "text-muted-foreground"}`}>
                    <span>{m.at}</span>
                    {m.from === "me" && m.status && (
                      m.status === "read" ? <CheckCheck className="w-3 h-3 text-cyan-200" /> :
                      m.status === "delivered" ? <CheckCheck className="w-3 h-3" /> :
                      <Check className="w-3 h-3" />
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            <AnimatePresence>
              {typing && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
                    <Dot delay={0} /><Dot delay={0.15} /><Dot delay={0.3} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick replies + AI templates */}
          <div className="px-3 pt-2 border-t border-border/60 flex flex-wrap gap-1.5">
            {QUICK_REPLIES.slice(0, 3).map((q) => (
              <button key={q} onClick={() => send(q)} className="press text-[11px] px-2.5 py-1 rounded-full border border-border hover:bg-secondary text-muted-foreground truncate max-w-[200px]">
                {q}
              </button>
            ))}
            <details className="relative">
              <summary className="press list-none cursor-pointer text-[11px] px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/10 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI
              </summary>
              <div className="absolute bottom-full mb-1 left-0 w-64 p-1 rounded-xl border border-border bg-popover shadow-xl z-20">
                {AI_TEMPLATES.map((t) => (
                  <button key={t.label} className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary text-xs flex items-start gap-2">
                    <t.icon className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground">{t.hint}</p>
                    </div>
                  </button>
                ))}
              </div>
            </details>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="p-3 flex items-center gap-2 border-t border-border/60"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Scrie către ${active.name.split(" ")[0]}…`}
              className="flex-1 h-11 px-4 rounded-full bg-secondary/60 border border-transparent focus:border-border outline-none text-sm"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="press w-11 h-11 rounded-full flex items-center justify-center text-white disabled:opacity-40"
              style={{ background: "var(--gradient-primary)", boxShadow: "0 4px 14px -2px oklch(0.55 0.25 290 / 0.5)" }}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      </div>

      <p className="text-center text-[10px] text-muted-foreground mt-4">
        🔒 Mesaje criptate end-to-end · Numărul tău <span className="font-mono">+40 31 805 1234</span>
      </p>
    </motion.div>
  );
}

function Avatar({ name, hue, online }: { name: string; hue: number; online?: boolean }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <div className="relative shrink-0">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-xs"
        style={{ background: `linear-gradient(135deg, oklch(0.62 0.22 ${hue}), oklch(0.7 0.2 ${hue + 30}))` }}
      >
        {initials}
      </div>
      {online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#25D366] ring-2 ring-background" />}
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
      animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
      transition={{ duration: 1, repeat: Infinity, delay }}
    />
  );
}

function aiReply(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("lead")) return "Astăzi: 47 lead-uri 📨\nTop sursă: TikTok (32)\nCPL mediu: €6,40 — sub target ✅";
  if (lower.includes("buget") || lower.includes("cheltui")) return "Cheltuit azi: €847 din €1.200 (zilnic)\nProiecție lună: €25.400\nRămas în plan: 18 zile";
  if (lower.includes("pauz") || lower.includes("opre")) return "Spune-mi numele campaniei pe care vrei să o pun pe pauză și o opresc în 5 secunde ⏸️";
  if (lower.includes("rapor") || lower.includes("performant")) return "📊 Raport rapid:\n• CTR: 3,2% (+0,4)\n• Conversii: 89\n• ROAS: 4,1x\nVrei să trimit detalii complete pe email?";
  return "Am notat ✍️ Lucrez la asta și revin în câteva secunde cu un răspuns concret.";
}