import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { Bot, CheckCheck, Lock, MessageCircle, Settings as SettingsIcon, Sparkles } from "lucide-react";
import { getMyWhatsAppInbox } from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  component: WhatsAppPage,
});

type Msg = { id: string; from: "me" | "them"; type: string; text: string; at: string };

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yst = new Date();
  yst.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Azi";
  if (same(d, yst)) return "Ieri";
  return d.toLocaleDateString("ro-RO", { day: "numeric", month: "long" });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

function WhatsAppPage() {
  const fetchInbox = useServerFn(getMyWhatsAppInbox);
  const { data, isLoading } = useQuery({
    queryKey: ["wa-inbox"],
    queryFn: () => fetchInbox(),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
  const scroller = useRef<HTMLDivElement>(null);

  const messages = (data?.messages ?? []) as Msg[];

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-3xl mx-auto px-3 md:px-5 pt-6 pb-28"
    >
      <div className="flex items-end justify-between gap-4 mb-5 px-1">
        <div>
          <StatusPill status={data?.connection?.status ?? null} loading={isLoading} />
          <h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight">
            Inbox <span className="gradient-text">WhatsApp</span> 💬
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Conversația ta cu asistentul AdPilot. Răspunde direct pe WhatsApp.
          </p>
        </div>
        <Link
          to="/settings"
          className="press hidden md:inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground"
        >
          <SettingsIcon className="w-3.5 h-3.5" /> Setări canal
        </Link>
      </div>

      <div className="card-floating overflow-hidden flex flex-col h-[70vh] min-h-[480px]">
        <header className="px-4 py-3 border-b border-border flex items-center gap-3 bg-background/60 backdrop-blur">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
               style={{ background: "linear-gradient(135deg, oklch(0.62 0.16 155), oklch(0.7 0.14 170))" }}>
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">AdPilot AI</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {data?.connection?.user_phone ? `Numărul tău ${data.connection.user_phone}` : "Asistentul tău de campanii"}
            </p>
          </div>
        </header>

        <div ref={scroller} className="flex-1 overflow-y-auto p-4 space-y-2 bg-[oklch(0.13_0.01_285)]/40">
          {isLoading ? (
            <CenterNote>Se încarcă conversația…</CenterNote>
          ) : data && data.allowed === false ? (
            <PlanGate />
          ) : !data?.connection ? (
            <NotConnected />
          ) : messages.length === 0 ? (
            <EmptyConversation number={data.central_number} />
          ) : (
            messages.map((m, i) => {
              const showDay = i === 0 || dayLabel(m.at) !== dayLabel(messages[i - 1].at);
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="flex justify-center my-3">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary/70 px-2.5 py-1 rounded-full">
                        {dayLabel(m.at)}
                      </span>
                    </div>
                  )}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap shadow-sm ${
                        m.from === "me" ? "rounded-tr-sm text-white" : "rounded-tl-sm bg-secondary text-foreground"
                      }`}
                      style={m.from === "me" ? { background: "var(--gradient-primary)" } : undefined}
                    >
                      {m.type !== "text" && !m.text ? (
                        <span className="italic opacity-80">[{m.type}]</span>
                      ) : (
                        m.text
                      )}
                      <div className={`mt-1 flex items-center gap-1 text-[10px] ${m.from === "me" ? "text-white/70 justify-end" : "text-muted-foreground"}`}>
                        <span>{timeLabel(m.at)}</span>
                        {m.from === "me" && <CheckCheck className="w-3 h-3" />}
                      </div>
                    </div>
                  </motion.div>
                </div>
              );
            })
          )}
        </div>

        {data?.connection && data.allowed !== false && (
          <div className="p-3 border-t border-border/60 flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>
              Vezi istoricul aici. Ca să-i scrii asistentului, deschide WhatsApp
              {data.central_number ? (
                <> la <span className="font-mono text-foreground">{data.central_number}</span></>
              ) : null}
              .
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function StatusPill({ status, loading }: { status: string | null; loading: boolean }) {
  const active = status === "active";
  const color = active ? "#25D366" : "#a1a1aa";
  const label = loading ? "Se verifică…" : active ? "WhatsApp conectat" : "WhatsApp neconectat";
  return (
    <div
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-medium border"
      style={{ color, background: `${color}1a`, borderColor: `${color}33` }}
    >
      <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: color }} /> {label}
    </div>
  );
}

function CenterNote({ children }: { children: React.ReactNode }) {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{children}</div>;
}

function NotConnected() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-4">
        <MessageCircle className="w-7 h-7 text-muted-foreground" />
      </div>
      <p className="font-semibold">Asistentul WhatsApp nu e activat</p>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        Activează asistentul ca să primești lead-uri, rapoarte și să controlezi campaniile direct pe WhatsApp.
      </p>
      <Link to="/settings" className="press mt-5 text-sm px-4 py-2 rounded-lg bg-foreground text-background">
        Activează în Setări
      </Link>
    </div>
  );
}

function EmptyConversation({ number }: { number: string | null }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="w-14 h-14 rounded-full bg-[#25D366]/15 flex items-center justify-center mb-4">
        <Sparkles className="w-7 h-7 text-[#25D366]" />
      </div>
      <p className="font-semibold">Încă nicio conversație</p>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        Scrie-i asistentului pe WhatsApp{number ? <> la <span className="font-mono text-foreground">{number}</span></> : null} —
        de exemplu <em>„arată-mi campaniile”</em> sau <em>„vreau o campanie nouă”</em>.
      </p>
    </div>
  );
}

function PlanGate() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mb-4">
        <Lock className="w-7 h-7 text-primary" />
      </div>
      <p className="font-semibold">Asistentul WhatsApp e pe planurile Pro și Premium</p>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        Planul Starter include lansarea campaniilor din aplicație. Fă upgrade ca să controlezi campaniile de pe WhatsApp.
      </p>
      <Link to="/settings" className="press mt-5 text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground">
        Vezi planurile
      </Link>
    </div>
  );
}
