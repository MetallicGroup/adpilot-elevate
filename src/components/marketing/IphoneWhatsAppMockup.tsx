import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import logoAsset from "@/assets/adpilot-chat-logo.png.asset.json";

type Msg = {
  side: "bot" | "user";
  text: string;
  typingMs?: number; // show typing indicator before message for this many ms
  delayMs?: number; // extra delay before this message appears
};

type Scene = {
  user: string;
  domain: string;
  script: Msg[];
};

const SCENES: Scene[] = [
  {
    user: "Andrei · Salon",
    domain: "frizerie",
    script: [
      {
        side: "bot",
        text:
          "☀️ Bună dimineața, Andrei! Raportul tău:\n\n💰 Cheltuit: 143 lei\n👥 Lead-uri: 21\n📉 Cost/lead: 6,8 lei\n⭐ Top: Tunsori Bărbați",
      },
      { side: "user", text: "Mărește bugetul la 200 lei", delayMs: 1500 },
      {
        side: "bot",
        text: "✅ Gata! Buget mărit la 200 lei/zi.\nEstimez ~28 lead-uri azi 🚀",
        typingMs: 1100,
      },
      {
        side: "bot",
        text:
          "🔔 Lead nou!\nNume: Maria Ionescu\nTelefon: 0722 XXX XXX\nServiciu: Tuns + Vopsit",
        delayMs: 2200,
      },
    ],
  },
  {
    user: "Cristina · Stomatologie",
    domain: "clinică dentară",
    script: [
      { side: "user", text: "Câte programări am azi din reclame?" },
      {
        side: "bot",
        text: "📅 9 programări noi azi.\n• 5 albire dentară\n• 3 implant\n• 1 consult gratuit",
        typingMs: 900,
      },
      { side: "user", text: "Oprește reclama la implant, e plin", delayMs: 1800 },
      {
        side: "bot",
        text: "⏸️ Campania «Implant Dentar» pusă pe pauză.\nEconomisești ~85 lei/zi 💸",
        typingMs: 800,
      },
    ],
  },
  {
    user: "Mihai · Auto",
    domain: "service auto",
    script: [
      {
        side: "bot",
        text:
          "📊 Săptămâna asta:\n\n🚗 47 lead-uri\n💰 Cheltuit: 890 lei\n📈 ROAS: 5,2x\n🔥 Top: Schimb ulei",
      },
      { side: "user", text: "Fă o reclamă pentru anvelope iarnă, buget 50/zi", delayMs: 1600 },
      {
        side: "bot",
        text: "🎯 OK! Generez reclama acum...",
        typingMs: 1500,
      },
      {
        side: "bot",
        text:
          "✅ Live!\n«Anvelope iarnă — montaj gratuit»\nBuget: 50 lei/zi\nReach estimat: 12.000 oameni/zi",
        typingMs: 1200,
      },
    ],
  },
  {
    user: "Elena · Restaurant",
    domain: "restaurant",
    script: [
      { side: "user", text: "Cum merg rezervările de weekend?" },
      {
        side: "bot",
        text: "🍽️ Vineri: 34 rezervări\nSâmbătă: 41 rezervări\nDuminică: 28 rezervări\n\n+62% vs weekend trecut 🎉",
        typingMs: 1000,
      },
      { side: "user", text: "Bravo! Dublează bugetul pe vineri", delayMs: 1800 },
      {
        side: "bot",
        text: "🚀 Buget dublat: 160 lei/zi vineri.\nEstimez +25 rezervări în plus.",
        typingMs: 900,
      },
    ],
  },
  {
    user: "Radu · Fitness",
    domain: "sală fitness",
    script: [
      {
        side: "bot",
        text: "🔔 Lead nou — Abonament Premium!\nNume: George Popa\nTel: 0744 XXX XXX\nInteres: Personal trainer",
      },
      { side: "user", text: "Trimite-i oferta de bun venit", delayMs: 1400 },
      {
        side: "bot",
        text: "✉️ Mesaj trimis pe WhatsApp.\n«50% reducere prima lună + 1 ședință PT gratuită»",
        typingMs: 1000,
      },
      {
        side: "bot",
        text: "💬 George a răspuns: «Sună interesant, când pot veni?»",
        delayMs: 2400,
      },
    ],
  },
  {
    user: "Ioana · E-commerce",
    domain: "magazin online",
    script: [
      { side: "user", text: "Care produs vinde cel mai bine azi?" },
      {
        side: "bot",
        text:
          "🛒 Top vânzări azi:\n\n1. Rochie florală — 23 buc\n2. Sandale piele — 14 buc\n3. Geantă crossbody — 9 buc\n\nTotal: 4.820 lei 💰",
        typingMs: 1100,
      },
      { side: "user", text: "Boost reclama la rochia florală", delayMs: 1600 },
      {
        side: "bot",
        text: "🔥 Buget +100 lei pe «Rochie florală».\nAud. extinsă spre orașe medii.",
        typingMs: 900,
      },
    ],
  },
];

const STEP_DELAY = 1400;
const LOOP_PAUSE = 2200;

export function IphoneWhatsAppMockup() {
  const [sceneIdx, setSceneIdx] = useState(0);
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

    let idx = 0;
    async function run() {
      while (!cancelled) {
        const scene = SCENES[idx % SCENES.length];
        setSceneIdx(idx % SCENES.length);
        setShow(true);
        setVisible(0);
        setTyping(false);
        await wait(500);
        for (let i = 0; i < scene.script.length; i++) {
          if (cancelled) return;
          const m = scene.script[i];
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
        await wait(800);
        idx++;
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
                className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-white flex items-center justify-center"
                style={{
                  boxShadow: "0 0 0 2px oklch(1 0 0 / 0.15)",
                }}
              >
                <img
                  src={logoAsset.url}
                  alt="AdPilot AI"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-semibold truncate">
                  AdPilot AI
                </p>
                <p className="text-[10px] text-white/80 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  online · {SCENES[sceneIdx].domain}
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
                  SCENES[sceneIdx].script.slice(0, visible).map((m, i) => (
                    <motion.div
                      key={`${sceneIdx}-${i}`}
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
                    key={`typing-${sceneIdx}`}
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