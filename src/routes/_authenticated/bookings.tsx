import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Flame, Loader2, Phone, Plus } from "lucide-react";
import { listBookings, updateBookingStatus } from "@/lib/booking/booking.functions";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({
    meta: [
      { title: "Programări | AdPilot" },
      { name: "description", content: "Toate programările primite din campaniile tale Facebook, cu scor de calificare." },
      { property: "og:title", content: "Programări | AdPilot" },
      { property: "og:description", content: "Gestionează programările venite din reclame și marchează rezultatul." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookingsPage,
});

const STATUSES = [
  { id: "pending", label: "În așteptare" },
  { id: "confirmed", label: "Confirmată" },
  { id: "attended", label: "S-a prezentat" },
  { id: "no_show", label: "Nu s-a prezentat" },
  { id: "won", label: "Client câștigat" },
  { id: "cancelled", label: "Anulată" },
];

function BookingsPage() {
  const fetchBookings = useServerFn(listBookings);
  const setStatus = useServerFn(updateBookingStatus);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchBookings({ data: filter ? { status: filter, limit: 100 } : { limit: 100 } });
      setRows(r as any[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Nu am putut încărca programările.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function change(id: string, status: string) {
    try {
      await setStatus({ data: { id, status: status as never } });
      setRows((list) => list.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (e: any) {
      toast.error(e?.message ?? "Nu am putut actualiza programarea.");
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">Programări</h1>
          <p className="mt-2 text-muted-foreground">Programările venite din paginile tale de booking, cu scor de calificare.</p>
        </div>
        <Link
          to="/programari"
          className="press inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Campanie nouă
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <FilterChip active={filter === ""} onClick={() => setFilter("")} label="Toate" />
        {STATUSES.map((s) => (
          <FilterChip key={s.id} active={filter === s.id} onClick={() => setFilter(s.id)} label={s.label} />
        ))}
      </div>

      {loading ? (
        <div className="mt-10 text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Se încarcă…
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-10 card-floating p-10 text-center">
          <CalendarDays className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="mt-3 font-medium">Nicio programare încă</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Lansează o campanie de programări și lead-urile vor apărea aici automat.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((b) => (
            <div key={b.id} className="card-floating p-5 flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate">{b.full_name}</span>
                  {b.qualification_tier === "hot" && <Flame className="w-4 h-4 text-orange-500" />}
                  <span className="text-xs text-muted-foreground">{b.qualification_score}/100</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {b.service_name} · {new Date(b.slot_start).toLocaleString("ro-RO", { dateStyle: "medium", timeStyle: "short" })}
                </p>
                {b.answers && Object.keys(b.answers).length ? (
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    {Object.entries(b.answers)
                      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("/") : v}`)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
              <a href={`tel:${b.phone}`} className="inline-flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4" /> {b.phone}
              </a>
              <select
                value={b.status}
                onChange={(e) => change(b.id, e.target.value)}
                className="h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-sm border ${active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
    >
      {label}
    </button>
  );
}