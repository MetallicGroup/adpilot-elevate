import { CountUp } from "@/components/wow/CountUp";
import { IphoneWhatsAppMockup } from "@/components/marketing/IphoneWhatsAppMockup";

const SPARK = [22, 38, 30, 52, 44, 68, 58, 82, 74, 96];

/**
 * Hero "command center" stage: a floating, tilted AdPilot control panel with
 * live metrics, overlapped by the WhatsApp assistant on a phone.
 */
export function CommandStage() {
  return (
    <div className="relative w-full" style={{ perspective: "1400px" }}>
      {/* stage glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full orb-pulse"
        style={{ background: "radial-gradient(circle, oklch(0.55 0.24 296 / 0.22), oklch(0.45 0.16 288 / 0.07) 45%, transparent 70%)" }}
      />

      <div className="relative mx-auto flex min-h-[520px] max-w-[760px] items-center justify-center lg:min-h-[620px]">
        {/* control panel */}
        <div className="tilt-left absolute left-0 top-2 hidden w-[70%] sm:block">
        <div
          className="wow-float overflow-hidden rounded-[27px]"
          style={{
            border: "1px solid oklch(0.62 0.2 300 / 0.44)",
            background: "linear-gradient(180deg, oklch(0.21 0.04 280) 0%, oklch(0.12 0.028 278) 100%)",
            boxShadow: "0 34px 110px oklch(0.28 0.13 300 / 0.38), 0 0 40px oklch(0.62 0.23 300 / 0.12), inset 0 1px oklch(1 0 0 / 0.04)",
          }}
        >
          <div className="flex h-[58px] items-center justify-between border-b border-white/[0.055] px-4">
            <b className="text-sm">AdPilot Command Center</b>
            <span className="flex items-center gap-1.5 text-[10px] text-success">
              <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-success" /> live
            </span>
          </div>

          <div className="flex gap-1.5 px-4 py-3">
            {["Prezentare", "Campanii", "Lead-uri", "AI"].map((t, i) => (
              <span
                key={t}
                className={`rounded-[9px] border px-2.5 py-1.5 text-[9px] ${
                  i === 0
                    ? "border-primary/25 bg-primary/15 text-primary-foreground"
                    : "border-white/5 bg-white/[0.03] text-muted-foreground"
                }`}
              >
                {t}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2 px-4 pb-3">
            {[
              { l: "Cheltuit azi", v: 1284, s: " lei", d: "+12%" },
              { l: "Clienți noi", v: 47, s: "", d: "+23%" },
              { l: "Cost/client", v: 32, s: " lei", d: "-8%" },
              { l: "ROAS", v: 4.1, s: "x", d: "+0,4", dec: 1 },
            ].map((m) => (
              <div key={m.l} className="rounded-xl border border-white/5 bg-black/25 p-2.5">
                <small className="block text-[9px] text-muted-foreground">{m.l}</small>
                <strong className="mt-1.5 block font-mono text-[15px]">
                  <CountUp to={m.v} decimals={m.dec ?? 0} suffix={m.s} />
                </strong>
                <span className="text-[9px] text-success">{m.d}</span>
              </div>
            ))}
          </div>

          <div className="mx-4 rounded-2xl border border-white/5 bg-black/30 p-3.5">
            <p className="mb-2.5 text-[11px] font-bold">Lead-uri · ultimele 10 zile</p>
            <div className="flex h-[110px] items-end gap-1.5">
              {SPARK.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{ height: `${h}%`, background: "var(--gradient-primary)", opacity: 0.45 + i * 0.055 }}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-1.5 p-4">
            {[
              ["Reduceri de Primăvară", "Facebook", "12 lead-uri"],
              ["Search · Servicii locale", "Google Ads", "8 lead-uri"],
            ].map(([a, b, c]) => (
              <div key={a} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-[10px] bg-white/[0.035] px-2.5 py-2 text-[9px] text-muted-foreground">
                <span className="flex items-center gap-1.5 text-foreground/85">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  {a}
                </span>
                <span>{b}</span>
                <span className="text-success">{c}</span>
              </div>
            ))}
          </div>
        </div>
        </div>

        {/* phone */}
        <div className="tilt-right relative z-10 sm:absolute sm:-right-8 sm:top-20">
          <div className="wow-float-slow">
            <IphoneWhatsAppMockup />
          </div>
        </div>
      </div>
    </div>
  );
}
