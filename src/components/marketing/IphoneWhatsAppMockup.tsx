import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

type Msg = {
  side: "bot" | "user";
  text: string;
  typingMs?: number; // show typing indicator before message for this many ms
  delayMs?: number; // extra delay before this message appears
};

const SCRIPT: Msg[] = [
  {
    side: "bot",
    text:
      "☀️ Bună dimineața! Raportul tău de azi:\n\n💰 Cheltuit: 143 lei\n👥 Lead-uri: 21\n📉 Cost/lead: 6,8 lei\n⭐ Cea mai bună reclamă: Promo Vară",
  },
  { side: "user", text: "Mărește bugetul la Promo Vară la 200 lei" },
  {
    side: "bot",
    text: "✅ Gata! Bugetul a fost mărit la 200 lei/zi.\nEstimez ~28 lead-uri azi 🚀",
    typingMs: 1000,
  },
  {
    side: "bot",
    text: "🔔 Lead nou primit!\nNume: Maria Ionescu\nTelefon: 0722 XXX XXX\nReclamă: Promo Vară",
    delayMs: 2000,
  },
];

const STEP_DELAY = 600;
const LOOP_PAUSE = 1800;

export function IphoneWhatsAppMockup() {
  const [visible, setVisible] = useState(0);
  const [typing, setTyping] = useState(false);
  const [show, setShow] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(() => resolve(), ms);
        timers.push(t);
      });

    async function run() {
      while (!cancelled) {
        setShow(true);
        setVisible(0);
        setTyping(false);
        await wait(400);
        for (let i = 0; i < SCRIPT.length; i++) {
          if (cancelled) return;
          const m = SCRIPT[i];
          if (m.delayMs) await wait(m.delayMs);
          if (m.typingMs) {
            setTyping(true);
            await wait(m.typingMs);
            setTyping(false);
          }
          setVisible(i + 1);
          await wait(STEP_DELAY);
        }
        await wait(LOOP_PAUSE);
        setShow(false);
        await wait(700);
      }
    }
    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 60, rotate: -6 }}
      animate={{ opacity: 1, x: 0, rotate: -6 }}
      transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
      className="relative mx-auto"
      style={{ width: "min(320px, 85%)" }}
    >
      {/* Purple glow */}
      <div
        className="absolute -inset-12 pointer-events-none blur-3xl opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at center, oklch(0.62 0.22 295 / 0.55), transparent 65%)",
        }}
      />

      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="relative"
      >
        {/* iPhone frame */}
        <div
          className="relative rounded-[2.75rem] p-[10px] shadow-2xl"
          style={{
            background:
              "linear-gradient(160deg, oklch(0.28 0.012 285), oklch(0.12 0.012 285))",
            boxShadow:
              "0 40px 80px -20px oklch(0.62 0.22 295 / 0.45), 0 20px 40px -20px oklch(0 0 0 / 0.6), inset 0 0 0 1px oklch(1 0 0 / 0.06)",
          }}
        >
          <div
            className="relative rounded-[2.25rem] overflow-hidden"
            style={{ background: "#0B141A", aspectRatio: "9 / 19.5" }}
          >
            {/* Notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-30" />

            {/* WhatsApp header */}
            <div
              className="relative z-20 flex items-center gap-3 px-3 pt-10 pb-3"
              style={{ background: "#075E54" }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.62 0.22 295), oklch(0.72 0.2 320))",
                }}
              >
                AP
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-semibold truncate">
                  AdPilot AI
                </p>
                <p className="text-[10px] text-white/80 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  online
                </p>
              </div>
            </div>

            {/* Chat area */}
            <div
              className="relative px-3 py-4 space-y-2 overflow-hidden"
              style={{
                background: "#0B141A",
                backgroundImage:
                  "radial-gradient(oklch(1 0 0 / 0.025) 1px, transparent 1px)",
                backgroundSize: "14px 14px",
                height: "calc(100% - 76px)",
              }}
            >
              <AnimatePresence>
                {show &&
                  SCRIPT.slice(0, visible).map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className={`flex ${m.side === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[82%] px-2.5 py-1.5 text-[11px] leading-snug whitespace-pre-line shadow-sm ${
                          m.side === "user"
                            ? "rounded-2xl rounded-tr-sm text-white"
                            : "rounded-2xl rounded-tl-sm text-white/95"
                        }`}
                        style={
                          m.side === "user"
                            ? { background: "#005C4B" }
                            : { background: "#202C33" }
                        }
                      >
                        {m.text}
                      </div>
                    </motion.div>
                  ))}
                {show && typing && (
                  <motion.div
                    key="typing"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex justify-start"
                  >
                    <div
                      className="rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-1"
                      style={{ background: "#202C33" }}
                    >
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-white/70 block"
                          animate={{ y: [0, -3, 0] }}
                          transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            delay: i * 0.15,
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}