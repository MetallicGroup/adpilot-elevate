import { createFileRoute, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Clock, Loader2, MapPin, Phone, ShieldCheck, Star } from "lucide-react";
import { getBookingLanding, getBookingSlots, submitBooking, trackBookingView } from "@/lib/booking/public.functions";
import { ymd } from "@/lib/booking/availability";
import type { LandingCopy } from "@/lib/booking/types";

export const Route = createFileRoute("/b/$slug")({
  loader: async ({ params }) => {
    const data = await getBookingLanding({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Pagina nu este disponibilă" }, { name: "robots", content: "noindex" }] };
    }
    const copy = (loaderData.page.landing_copy ?? {}) as LandingCopy;
    const title = `${copy.headline || loaderData.page.service} | ${loaderData.business?.name ?? "Programare online"}`;
    const description = copy.subheadline || `Programează-te online la ${loaderData.business?.name ?? ""}.`;
    return {
      meta: [
        { title: title.slice(0, 60) },
        { name: "description", content: description.slice(0, 155) },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(loaderData.page.hero_image_url?.startsWith("https://")
          ? [
              { property: "og:image", content: loaderData.page.hero_image_url },
              { name: "twitter:image", content: loaderData.page.hero_image_url },
            ]
          : []),
      ],
    };
  },
  notFoundComponent: BookingNotFound,
  errorComponent: BookingNotFound,
  component: BookingLandingPage,
});

function BookingNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center">
      <div>
        <h1 className="font-serif text-3xl">Pagina nu este disponibilă</h1>
        <p className="mt-2 text-muted-foreground">Această pagină de programare a fost oprită sau nu există.</p>
      </div>
    </div>
  );
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

function useAttribution() {
  const [attr, setAttr] = useState<Record<string, string | null>>({});
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const fbclid = p.get("fbclid");
    setAttr({
      fbclid,
      fbc: readCookie("_fbc") ?? (fbclid ? `fb.1.${Date.now()}.${fbclid}` : null),
      fbp: readCookie("_fbp"),
      utm_source: p.get("utm_source"),
      utm_medium: p.get("utm_medium"),
      utm_campaign: p.get("utm_campaign"),
      ad_id: p.get("ad_id") ?? p.get("adid"),
      adset_id: p.get("adset_id"),
      campaign_id: p.get("campaign_id"),
      landing_url: window.location.href.slice(0, 1000),
    });
  }, []);
  return attr;
}

function BookingLandingPage() {
  const data = Route.useLoaderData();
  const { slug } = Route.useParams();
  const attribution = useAttribution();
  const fetchSlots = useServerFn(getBookingSlots);
  const send = useServerFn(submitBooking);
  const track = useServerFn(trackBookingView);

  const copy = (data.page.landing_copy ?? {}) as LandingCopy;
  const services = data.services;
  const objective = ((data.page as { objective?: string }).objective ?? "bookings") as
    | "bookings"
    | "leads"
    | "calls"
    | "sales";
  const needsSlot = objective === "bookings";
  const callPhone = (data.page as { call_phone?: string | null }).call_phone ?? data.business?.phone ?? null;

  const [serviceId, setServiceId] = useState<string | null>(services[0]?.id ?? null);
  const [date, setDate] = useState<string>(ymd(new Date()));
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { slot_start: string }>(null);

  const days = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d;
      }),
    [],
  );

  useEffect(() => {
    track({ data: { slug, attribution } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Meta Pixel base code — încarcă fbq, inițializează pixelul campaniei și
  // trimite PageView. Fără el, evenimentele din browser (Schedule/Lead) nu
  // ajung la Meta, iar deduplicarea cu CAPI e imposibilă.
  useEffect(() => {
    const pixelId = data.page.pixel_id;
    if (!pixelId || typeof window === "undefined") return;
    const w = window as any;
    if (!w.fbq) {
      (function (f: any, b: any, e: string, v: string) {
        if (f.fbq) return;
        const n: any = (f.fbq = function (...args: any[]) {
          n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
        });
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = true;
        n.version = "2.0";
        n.queue = [];
        const t: any = b.createElement(e);
        t.async = true;
        t.src = v;
        const s: any = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(w, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    }
    if (w.__adpilotPixel !== pixelId) {
      w.fbq("init", pixelId);
      w.__adpilotPixel = pixelId;
    }
    w.fbq("track", "PageView");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.page.pixel_id]);

  useEffect(() => {
    if (!needsSlot) return;
    let cancelled = false;
    setSlotsLoading(true);
    setSlot(null);
    fetchSlots({ data: { slug, service_id: serviceId, date } })
      .then((r) => !cancelled && setSlots(r.slots))
      .catch(() => !cancelled && setSlots([]))
      .finally(() => !cancelled && setSlotsLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, serviceId, date, needsSlot]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (needsSlot && !slot) {
      setError("Alege un interval orar.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await send({
        data: {
          slug,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          service_id: serviceId,
          slot_start: needsSlot ? slot : null,
          answers,
          attribution,
        },
      });
      setDone({ slot_start: r.slot_start });
      // Același event_id ca pe server (CAPI) -> Meta deduplică cele două semnale.
      if (typeof (window as any).fbq === "function") {
        const eventName = (r as any).event_name ?? (needsSlot ? "Schedule" : "Lead");
        const eventId = (r as any).event_id;
        (window as any).fbq("track", eventName, {}, eventId ? { eventID: eventId } : undefined);
      }
    } catch (err: any) {
      setError(err?.message ?? "Nu am putut trimite programarea. Încearcă din nou.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    const when = new Date(done.slot_start).toLocaleString("ro-RO", { dateStyle: "full", timeStyle: "short" });
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-5">
        <div className="max-w-md w-full text-center card-floating p-8">
          <div className="w-14 h-14 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto">
            <Check className="w-7 h-7" />
          </div>
          <h1 className="mt-5 font-serif text-3xl">
            {needsSlot ? "Programarea ta e înregistrată" : "Cererea ta a fost trimisă"}
          </h1>
          {needsSlot ? <p className="mt-3 text-muted-foreground">{when}</p> : null}
          <p className="mt-4 text-sm text-muted-foreground">
            {data.business?.name} te va contacta la <strong className="text-foreground">{form.phone}</strong> pentru
            confirmare.
          </p>
          {data.business?.phone && (
            <a
              href={`tel:${data.business.phone}`}
              className="press mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-foreground text-background font-medium"
            >
              <Phone className="w-4 h-4" /> Sună acum
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {data.business?.logo_url ? (
              <img src={data.business.logo_url} alt={data.business?.name ?? ""} className="w-9 h-9 rounded-lg object-cover" />
            ) : null}
            <span className="font-semibold truncate">{data.business?.name}</span>
          </div>
          {data.business?.phone && (
            <a href={`tel:${data.business.phone}`} className="text-sm inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <Phone className="w-4 h-4" /> {data.business.phone}
            </a>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-10 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <section>
          {copy.offer_label ? (
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-primary/15 text-primary">
              <Star className="w-3.5 h-3.5" /> {copy.offer_label}
            </span>
          ) : null}
          <h1 className="mt-4 font-serif text-4xl md:text-5xl font-semibold tracking-tight">
            {copy.headline || data.page.service}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">{copy.subheadline}</p>

          {data.page.hero_image_url ? (
            <img
              src={data.page.hero_image_url}
              alt={copy.headline || data.page.service}
              loading="lazy"
              className="mt-7 w-full rounded-2xl object-cover aspect-[16/10]"
            />
          ) : null}

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {(copy.benefits ?? []).map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm">
                <Check className="w-4 h-4 text-success shrink-0 mt-0.5" /> {b}
              </li>
            ))}
          </ul>

          {copy.about ? (
            <div className="mt-8">
              <h2 className="font-semibold text-lg">Despre noi</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{copy.about}</p>
            </div>
          ) : null}

          {data.business?.address ? (
            <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" /> {data.business.address}
              {data.business.city ? `, ${data.business.city}` : ""}
            </p>
          ) : null}

          {(copy.faq ?? []).length ? (
            <div className="mt-8 space-y-4">
              <h2 className="font-semibold text-lg">Întrebări frecvente</h2>
              {(copy.faq ?? []).map((f) => (
                <div key={f.q}>
                  <p className="font-medium text-sm">{f.q}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{f.a}</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="lg:sticky lg:top-8 h-fit card-floating p-6">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            {needsSlot ? (
              <CalendarDays className="w-5 h-5 text-primary" />
            ) : (
              <Phone className="w-5 h-5 text-primary" />
            )}{" "}
            {copy.cta_label || (needsSlot ? "Programează-te acum" : "Lasă-ne un număr")}
          </h2>

          {objective === "calls" && callPhone ? (
            <a
              href={`tel:${callPhone}`}
              className="press mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-medium text-primary-foreground"
            >
              <Phone className="w-4 h-4" /> Sună acum {callPhone}
            </a>
          ) : null}
          {objective === "calls" ? (
            <p className="mt-4 text-sm text-muted-foreground">Sau lasă-ne numărul tău și te sunăm noi.</p>
          ) : null}

          <form onSubmit={onSubmit} className="mt-5 space-y-5">
            {services.length > 1 && (
              <div>
                <label className="text-sm font-medium">Serviciu</label>
                <div className="mt-2 grid gap-2">
                  {services.map((s: any) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setServiceId(s.id)}
                      className={`text-left px-4 py-3 rounded-xl border text-sm ${
                        serviceId === s.id ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="ml-2 text-muted-foreground text-xs">
                        {s.duration_min} min{s.price ? ` · ${s.price} lei` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {needsSlot && (
            <div>
              <label className="text-sm font-medium">Ziua</label>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {days.map((d) => {
                  const key = ymd(d);
                  const active = key === date;
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setDate(key)}
                      className={`shrink-0 w-16 py-2 rounded-xl border text-center ${
                        active ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <span className="block text-[10px] uppercase text-muted-foreground">
                        {d.toLocaleDateString("ro-RO", { weekday: "short" })}
                      </span>
                      <span className="block text-sm font-semibold">{d.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            {needsSlot && (
            <div>
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" /> Ora
              </label>
              {slotsLoading ? (
                <div className="mt-3 text-sm text-muted-foreground inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Se încarcă intervalele…
                </div>
              ) : slots.length ? (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {slots.map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setSlot(s)}
                      className={`py-2 rounded-lg border text-sm ${slot === s ? "border-primary bg-primary/5" : "border-border"}`}
                    >
                      {new Date(s).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Nu sunt intervale libere în această zi.</p>
              )}
            </div>
            )}

            {data.questions.map((q: any) => (
              <div key={q.key}>
                <label className="text-sm font-medium">
                  {q.label} {q.required ? <span className="text-destructive">*</span> : null}
                </label>
                {q.type === "single_select" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(q.options ?? []).map((o: string) => (
                      <button
                        type="button"
                        key={o}
                        onClick={() => setAnswers((a) => ({ ...a, [q.key]: o }))}
                        className={`px-3 py-2 rounded-lg border text-sm ${
                          answers[q.key] === o ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                ) : q.type === "multi_select" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(q.options ?? []).map((o: string) => {
                      const cur: string[] = answers[q.key] ?? [];
                      const on = cur.includes(o);
                      return (
                        <button
                          type="button"
                          key={o}
                          onClick={() =>
                            setAnswers((a) => ({
                              ...a,
                              [q.key]: on ? cur.filter((x) => x !== o) : [...cur, o],
                            }))
                          }
                          className={`px-3 py-2 rounded-lg border text-sm ${on ? "border-primary bg-primary/5" : "border-border"}`}
                        >
                          {o}
                        </button>
                      );
                    })}
                  </div>
                ) : q.type === "textarea" ? (
                  <textarea
                    rows={3}
                    value={answers[q.key] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                    className="mt-2 w-full px-4 py-3 rounded-xl bg-secondary border border-border text-sm"
                  />
                ) : (
                  <input
                    type={q.type === "number" ? "number" : q.type === "date" ? "date" : "text"}
                    value={answers[q.key] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                    className="mt-2 w-full px-4 py-3 rounded-xl bg-secondary border border-border text-sm"
                  />
                )}
              </div>
            ))}

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                required
                placeholder="Nume și prenume"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                className="px-4 py-3 rounded-xl bg-secondary border border-border text-sm"
              />
              <input
                required
                type="tel"
                placeholder="Telefon"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="px-4 py-3 rounded-xl bg-secondary border border-border text-sm"
              />
            </div>
            <input
              type="email"
              placeholder="Email (opțional)"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-sm"
            />

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting || (needsSlot && !slot)}
              className="press w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50"
            >
              {submitting
                ? "Se trimite…"
                : objective === "calls"
                  ? "Sună-mă tu"
                  : copy.cta_label || (needsSlot ? "Programează-te acum" : "Trimite cererea")}
            </button>

            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Datele tale sunt folosite doar pentru a te contacta legat de această solicitare.
              {data.business?.privacy_policy_url ? (
                <a href={data.business.privacy_policy_url} className="underline ml-1" target="_blank" rel="noreferrer">
                  Politica de confidențialitate
                </a>
              ) : null}
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}