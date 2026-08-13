import type { AvailabilityRule } from "./types";

function toMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Programul afacerii e ora locală românească. Serverul rulează pe UTC (Vercel),
// deci trebuie să convertim explicit ora de perete RO în instant UTC, altfel un
// program 09:00–18:00 ar apărea decalat cu +2/+3h la client.
const BUSINESS_TZ = "Europe/Bucharest";

/** Offset-ul (ms) al fusului la un anumit instant UTC (gestionează și DST). */
function tzOffsetMs(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  const asUTC = Date.UTC(map.year, map.month - 1, map.day, map.hour === 24 ? 0 : map.hour, map.minute, map.second);
  return asUTC - utcMs;
}

/** Ora de perete (dată + minute de la miezul nopții) în `tz` -> instant UTC (ms). */
function zonedWallToUtc(date: string, minutes: number, tz: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  const h = Math.floor(minutes / 60);
  const mi = minutes % 60;
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi);
  // Două treceri acoperă corect marginile de schimbare a orei (DST).
  const off1 = tzOffsetMs(utcGuess, tz);
  const off2 = tzOffsetMs(utcGuess - off1, tz);
  return utcGuess - off2;
}

/** Ziua săptămânii (0=Dum..6=Sâm) a datei, evaluată la prânz în `tz`. */
function zonedWeekday(date: string, tz: string): number {
  const noonUtc = zonedWallToUtc(date, 12 * 60, tz);
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(noonUtc));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

/**
 * Generează sloturile libere pentru o zi, ținând cont de program, durata
 * serviciului, bufferul dintre programări, blocaje și programările existente.
 * Toate calculele se fac pe timestamp-uri absolute (UTC ISO).
 */
export function slotsForDay(args: {
  date: string; // "YYYY-MM-DD"
  rules: AvailabilityRule[];
  durationMin: number;
  busy: Array<{ start: string; end: string }>;
  blackouts: Array<{ start: string; end: string }>;
  minLeadMinutes?: number;
  now?: Date;
}): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) return [];
  const weekday = zonedWeekday(args.date, BUSINESS_TZ);
  const rule = args.rules.find((r) => r.weekday === weekday);
  if (!rule) return [];

  const step = Math.max(10, rule.slot_min || 30);
  const duration = Math.max(10, args.durationMin || 60);
  const buffer = Math.max(0, rule.buffer_min || 0);
  const open = toMinutes(rule.start_time);
  const close = toMinutes(rule.end_time);
  const now = args.now ?? new Date();
  const earliest = now.getTime() + (args.minLeadMinutes ?? 120) * 60_000;

  const taken = [...args.busy, ...args.blackouts].map((b) => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));

  const out: string[] = [];
  for (let m = open; m + duration <= close; m += step) {
    const startMs = zonedWallToUtc(args.date, m, BUSINESS_TZ);
    const endMs = startMs + duration * 60_000;
    if (startMs < earliest) continue;
    const overlaps = taken.some((t) => startMs < t.end + buffer * 60_000 && endMs + buffer * 60_000 > t.start);
    if (overlaps) continue;
    out.push(new Date(startMs).toISOString());
  }
  return out;
}

export const DEFAULT_AVAILABILITY: AvailabilityRule[] = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  start_time: "09:00",
  end_time: "18:00",
  slot_min: 30,
  buffer_min: 0,
}));

export const WEEKDAY_LABELS = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];