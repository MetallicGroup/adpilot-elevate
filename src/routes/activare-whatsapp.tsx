import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getMyWhatsApp, saveMyWhatsAppPhone } from "@/lib/whatsapp.functions";
import { getFlowState } from "@/lib/v3.functions";
import {
  FlowShell,
  Icon,
  Loading,
  errMsg,
  logoUrl,
  useRequireSession,
  v3Head,
} from "@/components/v3/ui";

export const Route = createFileRoute("/activare-whatsapp")({
  head: () =>
    v3Head("Activează WhatsApp — AdPilot", undefined, [{ name: "robots", content: "noindex" }]),
  component: WhatsAppPage,
});

const pretty = (p: string | null | undefined) => {
  const d = (p ?? "").replace(/\D/g, "").replace(/^40/, "0");
  return d.replace(/^(\d{4})(\d{3})(\d{3}).*/, "$1 $2 $3") || "numărul tău";
};

function WhatsAppPage() {
  const session = useRequireSession();
  const waFn = useServerFn(getMyWhatsApp);
  const saveFn = useServerFn(saveMyWhatsAppPhone);
  const flowFn = useServerFn(getFlowState);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const poll = useRef<number | null>(null);

  useEffect(() => {
    if (session !== "ok") return;
    Promise.all([waFn().catch(() => null), flowFn().catch(() => null)]).then(([w, f]) => {
      const conn = (w as any)?.connection;
      setActive(conn?.status === "active");
      setPhone(conn?.user_phone ?? f?.phone ?? "");
      setName((f?.name ?? "").split(/\s+/)[0] ?? "");
      setLoaded(true);
    });
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [session, waFn, flowFn]);

  async function activate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (phone.replace(/\D/g, "").length < 9) return setError("Scrie numărul tău de WhatsApp.");
    try {
      const r: any = await saveFn({ data: { phone } });
      setCode(r.activation_code ?? null);
      if (r.activation_link) window.open(r.activation_link, "_blank", "noopener");
      setWaiting(true);
      poll.current = window.setInterval(async () => {
        const w: any = await waFn().catch(() => null);
        if (w?.connection?.status === "active") {
          setActive(true);
          setWaiting(false);
          if (poll.current) clearInterval(poll.current);
        }
      }, 3000);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  if (session !== "ok" || !loaded) return <Loading />;

  return (
    <FlowShell step={4}>
      <div className="wgrid">
        <div>
          <p className="kicker">Pasul 5 din 5</p>
          <h1>{active ? "Clienții îți vin pe WhatsApp" : "Unde îți trimitem clienții?"}</h1>
          <p className="intro">
            {active
              ? `Totul e gata. Fiecare cerere îți vine pe ${pretty(phone)} în câteva minute.`
              : "Activează WhatsApp-ul și fiecare cerere îți vine pe telefon în câteva minute."}
          </p>
          <ul className="benefits">
            {[
              "Fiecare cerere nouă, cu nume, telefon și buton de răspuns",
              "Cifrele zilei, în fiecare seară",
              "Schimbi bugetul sau pui pauză scriind un mesaj",
              "Ești anunțat imediat dacă Facebook oprește ceva",
            ].map((t) => (
              <li key={t}>
                <span className="ok-dot">
                  <Icon n="check" />
                </span>
                {t}
              </li>
            ))}
          </ul>
          {active ? (
            <div className="go-row">
              <a className="btn btn-ink" href="/panou">
                Mergi la panou <Icon n="arrow" />
              </a>
              <span className="note">WhatsApp activ ✓</span>
            </div>
          ) : (
            <>
              <form className="wform" onSubmit={activate} noValidate>
                <div className="field">
                  <label htmlFor="w-phone">Numărul tău de WhatsApp</label>
                  <input
                    className="input"
                    id="w-phone"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07xx xxx xxx"
                  />
                </div>
                <button className="btn btn-wa" type="submit" disabled={waiting}>
                  <Icon n="wa" />
                  {waiting ? "Aștept mesajul…" : "Activează pe WhatsApp"}
                </button>
              </form>
              <p className="wnote">
                {waiting
                  ? `S-a deschis WhatsApp cu un mesaj gata scris${code ? ` (cod ${code})` : ""}. Apasă „Trimite” și pagina se actualizează singură.`
                  : "Se deschide WhatsApp cu un mesaj gata scris. Tu doar apeși „Trimite”."}
              </p>
              {error ? (
                <p className="hint" style={{ color: "var(--bad)" }}>
                  {error}
                </p>
              ) : null}
              <p className="wnote">
                <a className="link-accent" href="/panou">
                  Activez mai târziu
                </a>
              </p>
            </>
          )}
        </div>
        <div className="wphone">
          <div className="phone">
            <div className="phone-screen">
              <div className="wa-top">
                <img src={logoUrl} alt="" />
                <div>
                  <b>AdPilot</b>
                  <small>cont de business</small>
                </div>
              </div>
              <div className="wa-chat" style={{ display: "flex" }}>
                {active ? (
                  <div className="msg on">
                    Gata{name ? `, ${name}` : ""}! ✅
                    <br />
                    De acum îți trimit aici fiecare cerere, cu nume și telefon. Te anunț și când
                    Facebook aprobă campania.<span className="t">acum</span>
                  </div>
                ) : (
                  <div className="empty-chat">
                    <Icon n="wa" />
                    Aici îți vor veni clienții.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </FlowShell>
  );
}
