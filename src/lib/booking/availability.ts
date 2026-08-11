import type { AvailabilityRule } from "./types";

function toMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const day = new Date(`${args.date}T00:00:00`);
  if (Number.isNaN(day.getTime())) return [];
  const rule = args.rules.find((r) => r.weekday === day.getDay());
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
    const start = new Date(day);
    start.setMinutes(m);
    const startMs = start.getTime();
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