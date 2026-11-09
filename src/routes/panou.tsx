import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPanel,
  setDailyBudget,
  setLeadStatus,
  type Panel,
  type PanelCampaign,
} from "@/lib/v3.functions";
import {
  Icon,
  Loading,
  Logo,
  errMsg,
  fmtLei2,
  help,
  initials,
  useRequireSession,
  v3Head,
  waLink,
  waDigits,
} from "@/components/v3/ui";

export const Route = createFileRoute("/panou")({
  head: () => v3Head("Panou — AdPilot", undefined, [{ name: "robots", content: "noindex" }]),
  component: PanelPage,
});

const STATUS: Array<[string, string]> = [
  ["new", "Nou"],
  ["contacted", "Sunat"],
  ["booked", "Programat"],
];

function when(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "acum";
  if (m < 60) return `acum ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `acum ${h} ${h === 1 ? "oră" : "ore"}`;
  return new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
}

function phase(c: PanelCampaign): { cls: "live" | "review"; label: string; step: number } {
  if (c.status === "pending_payment" || c.status === "publishing")
    return { cls: "review", label: "Se trimite la Facebook", step: 1 };
  if (c.status === "draft")
    return { cls: "review", label: c.error ? "Nu a pornit" : "Neplătită", step: 0 };
  if (c.status === "paused") return { cls: "review", label: "Pe pauză", step: 3 };
  if (c.reviewState === "delivering" || c.spendTotal > 0)
    return { cls: "live", label: "Live", step: 4 };
  return { cls: "review", label: "În verificare la Facebook", step: 2 };
}

function PanelPage() {
  const session = useRequireSession();
  const panelFn = useServerFn(getPanel);
  const statusFn = useServerFn(setLeadStatus);
  const budgetFn = useServerFn(setDailyBudget);
  const [p, setP] = useState<Panel | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const budgetTimer = useRef<number | null>(null);

  const load = useCallback(
    () =>
      panelFn()
        .then(setP)
        .catch(() => {}),
    [panelFn],
  );
  useEffect(() => {
    if (session !== "ok") return;
    void load();
    const t = window.setInterval(() => void load(), 20000);
    return () => clearInterval(t);
  }, [session, load]);

  function flash(m: string) {
    setToast(m);
    window.setTimeout(() => setToast(null), 2600);
  }

  async function cycleStatus(id: string, cur: string) {
    const idx = STATUS.findIndex((s) => s[0] === cur);
    const next = STATUS[(idx + 1) % STATUS.length]![0];
    setP((prev) =>
      prev
        ? { ...prev, leads: prev.leads.map((l) => (l.id === id ? { ...l, status: next } : l)) }
        : prev,
    );
    await statusFn({ data: { id, status: next } }).catch(() =>
      flash("Nu am putut salva statusul."),
    );
  }

  function bump(c: PanelCampaign, d: number) {
    const budget = Math.min(1000, Math.max(30, c.budget + d));
    setP((prev) =>
      prev
        ? { ...prev, campaigns: prev.campaigns.map((x) => (x.id === c.id ? { ...x, budget } : x)) }
        : prev,
    );
    if (budgetTimer.current) clearTimeout(budgetTimer.current);
    budgetTimer.current = window.setTimeout(async () => {
      try {
        await budgetFn({ data: { id: c.id, budget } });
        flash(`Bugetul e acum ${budget} lei pe zi.`);
      } catch (e) {
        flash(errMsg(e));
        void load();
      }
    }, 900);
  }

  if (session !== "ok" || !p) return <Loading />;
  const first = p.name.trim().split(/\s+/)[0] || "";
  const main = p.campaigns[0] ?? null;
  const spentToday = p.campaigns.reduce((s, c) => s + c.spendToday, 0);
  const leadsTotal = p.campaigns.reduce((s, c) => s + c.leadsTotal, 0) || p.leads.length;
  const spendTotal = p.campaigns.reduce((s, c) => s + c.spendTotal, 0);

  return (
    <div className="v3">
      <header className="app-top">
        <div className="wrap app-top-in" style={{ maxWidth: "none" }}>
          <Logo href="/panou" />
          <a
            className="help"
            style={{ marginLeft: "auto" }}
            href={help(
              `Salut Daniel, sunt ${p.name || "client AdPilot"}. Am o întrebare despre campanie.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon n="wa" />
            <span>Ajutor</span>
          </a>
        </div>
      </header>
      <div className="dash">
        <nav className="side" aria-label="Meniu">
          <a className="on" href="#campanii">
            <Icon n="megaphone" />
            Campanii
          </a>
          <a href="#cereri">
            <Icon n="users" />
            Cereri
            {p.leadsToday ? <span className="cnt">{p.leadsToday}</span> : null}
          </a>
          <a href="/settings">
            <Icon n="card" />
            Plăți
          </a>
          <a href="/settings">
            <Icon n="gear" />
            Setări
          </a>
          <div className="grow" />
          <div className="helpcard">
            Te-ai blocat undeva?
            <br />
            <a
              href={help("Salut Daniel, am nevoie de ajutor cu AdPilot.")}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon n="wa" />
              Scrie-i lui Daniel
            </a>
          </div>
        </nav>
        <section className="main">
          <div className="main-head" id="campanii">
            <h1>Bună{first ? `, ${first}` : ""}</h1>
            <a className="btn btn-line btn-sm" href="/campanie">
              <Icon n="plus" />
              Campanie nouă
            </a>
          </div>

          {p.campaigns.length === 0 ? (
            <div className="ccard" style={{ display: "block" }}>
              <b>Nu ai încă nicio campanie</b>
              <span>Fă prima în 3 minute. O vezi gata înainte să plătești.</span>
              <div className="go-row" style={{ marginTop: 16 }}>
                <a className="btn btn-ink" href="/campanie">
                  Fă campania <Icon n="arrow" />
                </a>
              </div>
            </div>
          ) : (
            p.campaigns.slice(0, 6).map((c) => {
              const ph = phase(c);
              return (
                <div className="ccard" key={c.id}>
                  {c.mediaUrl ? <img src={c.mediaUrl} alt="" /> : <span />}
                  <div>
                    <b>{c.name}</b>
                    <span>
                      {[
                        c.city ? `${c.city}${c.radius ? ` + ${c.radius} km` : ""}` : null,
                        c.dest === "wa" ? "mesaje pe WhatsApp" : "formular",
                        `${c.budget} lei/zi`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <span className={`status ${ph.cls}`}>{ph.label}</span>
                  {c.status === "draft" && c.error ? (
                    <div className="pipe" style={{ display: "block" }}>
                      <p style={{ color: "var(--bad)", fontSize: 14 }}>{c.error}</p>
                      <div className="go-row" style={{ marginTop: 12 }}>
                        <a className="btn btn-line btn-sm" href={`/plata?c=${c.id}`}>
                          Încearcă din nou
                        </a>
                        <a
                          className="btn btn-wa btn-sm"
                          href={help(`Salut Daniel, campania „${c.name}” nu a pornit: ${c.error}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Icon n="wa" />
                          Scrie-i lui Daniel
                        </a>
                      </div>
                    </div>
                  ) : c.status === "draft" ? (
                    <div className="pipe" style={{ display: "block" }}>
                      <a className="btn btn-ink btn-sm" href={`/plata?c=${c.id}`}>
                        Pornește campania <Icon n="arrow" />
                      </a>
                    </div>
                  ) : (
                    <div className="pipe">
                      {[
                        "Plătită",
                        "Trimisă la Facebook",
                        ph.step >= 3 ? "Aprobată" : "Se verifică…",
                        "Live",
                      ].map((label, i) => (
                        <div
                          key={label}
                          className={i < ph.step ? "done" : i === ph.step ? "now" : ""}
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div className="kpis">
            <div className="kpi">
              <small>Cereri</small>
              <b>{leadsTotal}</b>
            </div>
            <div className="kpi">
              <small>Cost pe cerere</small>
              <b>
                {leadsTotal && spendTotal ? fmtLei2(spendTotal / leadsTotal) : "—"}
                {leadsTotal && spendTotal ? (
                  <span style={{ fontSize: 15, color: "var(--muted)", fontWeight: 500 }}> lei</span>
                ) : null}
              </b>
            </div>
            <div className="kpi">
              <small>Cheltuit azi</small>
              <b>
                {fmtLei2(spentToday)}
                <span style={{ fontSize: 15, color: "var(--muted)", fontWeight: 500 }}> lei</span>
              </b>
            </div>
            <div className="kpi">
              <small>Buget pe zi</small>
              {main ? (
                <div className="step">
                  <button onClick={() => bump(main, -5)} aria-label="Scade bugetul">
                    −
                  </button>
                  <b>{main.budget}</b>
                  <button onClick={() => bump(main, 5)} aria-label="Crește bugetul">
                    +
                  </button>
                </div>
              ) : (
                <b>—</b>
              )}
            </div>
          </div>

          <div className="leads" id="cereri">
            <div className="leads-head">
              <h2>Cereri</h2>
              <span>
                <Icon n="wa" />
                {p.waActive
                  ? "Fiecare cerere îți vine și pe WhatsApp"
                  : "Activează WhatsApp ca să primești cererile pe telefon"}
              </span>
            </div>
            {!p.waActive ? (
              <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)" }}>
                <a className="btn btn-wa btn-sm" href="/activare-whatsapp">
                  <Icon n="wa" />
                  Activează WhatsApp
                </a>
              </div>
            ) : null}
            {p.leads.length === 0 ? (
              <div className="empty">
                <b>
                  {main && phase(main).cls === "live"
                    ? "Campania e live. Așteptăm primele cereri."
                    : "Nicio cerere încă"}
                </b>
                {main && phase(main).cls === "live"
                  ? "De obicei vin în primele ore. Îți scriem pe WhatsApp la fiecare."
                  : "Când Facebook aprobă campania, cererile apar aici și pe WhatsApp."}
              </div>
            ) : (
              p.leads.map((l) => {
                const st = STATUS.find((s) => s[0] === l.status) ?? STATUS[0]!;
                const cls =
                  st[0] === "new" ? "s-new" : st[0] === "contacted" ? "s-called" : "s-booked";
                return (
                  <div className="lrow" key={l.id}>
                    <span className="av">{initials(l.name)}</span>
                    <div>
                      <b>{l.name}</b>
                      <span>
                        {l.phone ?? "fără telefon"} · {when(l.createdAt)}
                      </span>
                    </div>
                    <div className="want">{l.message ?? ""}</div>
                    <button
                      className={`pill ${cls}`}
                      onClick={() => void cycleStatus(l.id, l.status)}
                    >
                      {st[1]}
                    </button>
                    {l.phone ? (
                      <a
                        className="btn btn-wa"
                        href={waLink(
                          waDigits(l.phone),
                          `Bună ziua, ${l.name.split(" ")[0]}! Vă contactez în legătură cu cererea dumneavoastră.`,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon n="wa" />
                        Scrie-i
                      </a>
                    ) : (
                      <span />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
      {toast ? (
        <div
          className="proto"
          style={{ left: "50%", transform: "translateX(-50%)", bottom: 90, right: "auto" }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
