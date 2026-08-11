import { useMemo } from "react";

type Point = { date: string; spend: number; leads: number };

const W = 780;
const H = 230;

function smoothPath(values: number[], max: number) {
  if (values.length < 2) return "";
  const step = W / (values.length - 1);
  const y = (v: number) => H - 26 - (max > 0 ? (v / max) * (H - 60) : 0);
  const pts = values.map((v, i) => [i * step, y(v)] as const);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const cx = (x0 + x1) / 2;
    d += ` C${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`;
  }
  return d;
}

export function PerformanceChart({ data }: { data: Point[] }) {
  const { spendPath, leadsPath, spendArea, leadsArea, labels } = useMemo(() => {
    const maxSpend = Math.max(1, ...data.map((d) => d.spend));
    const maxLeads = Math.max(1, ...data.map((d) => d.leads));
    const sp = smoothPath(data.map((d) => d.spend), maxSpend);
    const lp = smoothPath(data.map((d) => d.leads), maxLeads);
    const close = (p: string) => (p ? `${p} L${W} ${H} L0 ${H} Z` : "");
    return {
      spendPath: sp,
      leadsPath: lp,
      spendArea: close(sp),
      leadsArea: close(lp),
      labels: data.map((d) =>
        new Date(d.date + "T00:00:00Z").toLocaleDateString("ro-RO", { weekday: "short", timeZone: "UTC" }),
      ),
    };
  }, [data]);

  return (
    <div className="px-4 pb-2 sm:px-5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-[190px] w-full sm:h-[225px]"
      >
        <defs>
          <linearGradient id="areaBlue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#687cff" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#687cff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="areaPurple" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bd63ff" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#bd63ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g stroke="rgba(255,255,255,.055)" strokeWidth="1">
          {[40, 90, 140, 190].map((y) => (
            <line key={y} x1="0" y1={y} x2={W} y2={y} />
          ))}
        </g>
        {spendArea && <path d={spendArea} fill="url(#areaBlue)" />}
        {spendPath && (
          <path d={spendPath} fill="none" stroke="#6c7cff" strokeWidth="4" strokeLinecap="round" />
        )}
        {leadsArea && <path d={leadsArea} fill="url(#areaPurple)" />}
        {leadsPath && (
          <path d={leadsPath} fill="none" stroke="#bd63ff" strokeWidth="4" strokeLinecap="round" />
        )}
      </svg>
      <div className="flex justify-between px-1 text-[9px] capitalize text-muted-foreground">
        {labels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: "#6c7cff" }} />
          Cheltuieli
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: "#bd63ff" }} />
          Clienți potențiali
        </span>
      </div>
    </div>
  );
}
