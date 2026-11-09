import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { getPayState, launchCampaign, setCampaignDest, type PayState } from "@/lib/v3.functions";
import {
  FlowShell,
  Icon,
  Loading,
  errMsg,
  fmtLei,
  help,
  useRequireSession,
  v3Head,
} from "@/components/v3/ui";

export const Route = createFileRoute("/plata")({
  validateSearch: (s: Record<string, unknown>): { c?: string; paid?: string } => ({
    c: typeof s.c === "string" ? s.c : undefined,
    paid: typeof s.paid === "string" ? s.paid : undefined,
  }),
  head: () =>
    v3Head("Pornește campania — AdPilot", undefined, [{ name: "robots", content: "noindex" }]),
  component: PayPage,
});

function PayPage() {
  const session = useRequireSession();
  const { c, paid } = Route.useSearch();
  const stateFn = useServerFn(getPayState);
  const destFn = useServerFn(setCampaignDest);
  const launchFn = useServerFn(launchCampaign);
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();
  const [st, setSt] = useState<PayState | null>(null);
  const [dest, setDest] = useState<"form" | "wa">("form");
  const [agreed, setAgreed] = useState(false);
  const [phase, setPhase] = useState<"idle" | "confirming" | "launching" | "done" | "failed">(
    paid ? "confirming" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [errorLink, setErrorLink] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (session !== "ok" || !c) return;
    stateFn({ data: { id: c } })
      .then((s) => {
        setSt(s);
        if (s.draft) setDest(s.draft.dest);
        if (s.draft && ["active", "publishing"].includes(s.draft.status) && !paid) setPhase("done");
      })
      .catch(() => setSt({ draft: null, hasAdsPlan: false, waAvailable: null, waNumber: null }));
  }, [session, c, stateFn, paid]);

  // Întoarcerea din Stripe: așteptăm abonamentul, apoi pornim campania (webhook-ul o poate porni și el, e sigur).
  useEffect(() => {
    if (session !== "ok" || !c || !paid || started.current) return;
    started.current = true;
    let tries = 0;
    const tick = async () => {
      tries += 1;
      const s = await stateFn({ data: { id: c } }).catch(() => null);
      if (s) setSt(s);
      if (s?.draft?.status === "active") return setPhase("done");
      if (s?.hasAdsPlan) return void launch();
      if (tries < 30) setTimeout(() => void tick(), 2000);
      else {
        setPhase("failed");
        setError(
          "Plata încă nu a ajuns la noi. Dacă ai plătit, scrie-i lui Daniel și o pornim imediat.",
        );
      }
    };
    void tick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, c, paid]);

  async function chooseDest(d: "form" | "wa") {
    setDest(d);
    if (c) await destFn({ data: { id: c, dest: d } }).catch(() => {});
  }

  async function launch() {
    if (!c) return;
    setPhase("launching");
    setError(null);
    try {
      const r: any = await launchFn({ data: { id: c } });
      if (r.ok) return setPhase("done");
      if (r.problem === "unpaid") {
        setTimeout(() => void launch(), 2500);
        return;
      }
      setPhase("failed");
      setError(r.error ?? "Facebook n-a primit campania.");
      setErrorLink(r.link ?? null);
    } catch (e) {
      setPhase("failed");
      setError(errMsg(e));
    }
  }

  async function pay() {
    if (!c) return;
    if (!agreed) return setError("Bifează că ești de acord să pornim imediat după plată.");
    if (dest === "wa" && st?.waAvailable === false)
      return setError(
        "Leagă întâi numărul de WhatsApp de pagina de Facebook sau alege formularul.",
      );
    setError(null);
    await destFn({ data: { id: c, dest, pending: true } }).catch(() => {});
    openCheckout({
      priceId: "afacere_monthly",
      returnUrl: `${window.location.origin}/plata?c=${c}&paid=1`,
      waiver: true,
    });
  }

  if (session !== "ok" || !st) return <Loading />;
  const d = st.draft;
  if (!c || !d)
    return (
      <FlowShell step={3} narrow>
        <h1>Nu găsesc campania</h1>
        <p className="intro">Fă campania din nou; durează două minute.</p>
        <div className="go-row">
          <a className="btn btn-ink" href="/campanie">
            Fă campania <Icon n="arrow" />
          </a>
        </div>
      </FlowShell>
    );

  if (phase === "done")
    return (
      <FlowShell step={3} narrow>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="big-ok">
            <Icon n="check" />
          </div>
          <h1 style={{ marginTop: 20 }}>Campania a plecat la Facebook</h1>
          <p className="intro" style={{ margin: "12px auto 0" }}>
            Facebook o verifică de obicei în câteva ore. Ultimul pas: spune-ne unde să-ți trimitem
            clienții.
          </p>
          <div className="go-row" style={{ justifyContent: "center" }}>
            <a className="btn btn-ink" href={`/activare-whatsapp?c=${c}`}>
              Activează WhatsApp <Icon n="arrow" />
            </a>
          </div>
        </div>
      </FlowShell>
    );

  if (phase === "confirming" || phase === "launching")
    return (
      <FlowShell step={3} narrow>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="spin" />
          <h1 style={{ marginTop: 20, fontSize: 28 }}>
            {phase === "confirming" ? "Confirmăm plata…" : "Trimitem campania la Facebook…"}
          </h1>
          <p className="intro" style={{ margin: "12px auto 0" }}>
            Durează câteva secunde. Nu închide pagina.
          </p>
        </div>
      </FlowShell>
    );

  const month = d.budget * 30;
  const destLabel = dest === "wa" ? "mesaje pe WhatsApp" : "formular";
  const isVideo = d.mediaMime.startsWith("video/");

  return (
    <FlowShell step={3}>
      <h1>Ultimul pas înainte de lansare</h1>
      <p className="intro">
        {st.hasAdsPlan
          ? "Ai deja pachetul cu reclame. Alege cum vrei să-ți vină clienții și pornim."
          : "Plătești abonamentul, iar campania pleacă la Facebook în câteva minute."}
      </p>
      <div className="pgrid">
        <div className="pay-top">
          <div className="sum">
            {d.mediaUrl ? (
              isVideo ? (
                <video
                  src={d.mediaUrl}
                  muted
                  playsInline
                  style={{ width: 76, height: 76, borderRadius: 12, objectFit: "cover" }}
                />
              ) : (
                <img src={d.mediaUrl} alt="" />
              )
            ) : (
              <span />
            )}
            <div>
              <b>
                {d.what}
                {d.offer ? ` ${d.offer}` : ""}
              </b>
              <span>
                {d.city} + {d.radius} km · {d.budget} lei pe zi · {destLabel}
              </span>
              {d.pageName ? <span>Pagina: {d.pageName}</span> : null}
            </div>
            <a className="link-accent" href={`/campanie?c=${d.id}`}>
              Modifică
            </a>
          </div>

          {phase === "failed" && error ? (
            <div className="fix" style={{ marginTop: 14 }}>
              <h3>Campania nu a pornit încă</h3>
              <p>{error}</p>
              <div className="acts">
                {errorLink ? (
                  <a
                    className="btn btn-ink"
                    href={errorLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Rezolvă la Facebook
                  </a>
                ) : null}
                {st.hasAdsPlan ? (
                  <button className="btn btn-line" onClick={() => void launch()}>
                    Încearcă din nou
                  </button>
                ) : null}
                <a
                  className="btn btn-wa"
                  href={help(
                    `Salut Daniel, am plătit AdPilot, dar campania „${d.what}” nu a pornit: ${error}`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon n="wa" />
                  Scrie-i lui Daniel
                </a>
              </div>
            </div>
          ) : null}

          <div className="dest">
            <h3>Cum vrei să-ți vină clienții?</h3>
            <p className="sub">Alege o variantă. O poți schimba oricând, scriind pe WhatsApp.</p>
            <div className="dest-opts" role="radiogroup">
              <button
                type="button"
                role="radio"
                aria-checked={dest === "form"}
                className={`dopt${dest === "form" ? " on" : ""}`}
                onClick={() => void chooseDest("form")}
              >
                <span className="dopt-head">
                  <span className="dopt-ico">
                    <Icon n="form" />
                  </span>
                  <b>Formular</b>
                  <span className="pg-rec">Recomandat</span>
                  <span className="pg-radio" />
                </span>
                <span className="dopt-txt">
                  Omul apasă pe reclamă și lasă numele și telefonul, fără să scrie nimic. Cererea
                  îți vine pe WhatsApp.
                </span>
                <span className="dopt-pros">
                  <span>
                    <Icon n="check" />
                    Cele mai multe cereri
                  </span>
                  <span>
                    <Icon n="check" />
                    Cel mai mic cost pe cerere
                  </span>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={dest === "wa"}
                className={`dopt${dest === "wa" ? " on" : ""}`}
                onClick={() => void chooseDest("wa")}
              >
                <span className="dopt-head">
                  <span className="dopt-ico wa">
                    <Icon n="wa" />
                  </span>
                  <b>Mesaje pe WhatsApp</b>
                  <span className="pg-radio" />
                </span>
                <span className="dopt-txt">
                  Omul apasă pe reclamă și îți scrie direct pe WhatsApp-ul afacerii.
                </span>
                <span className="dopt-pros">
                  <span>
                    <Icon n="check" />
                    Vorbești direct cu omul
                  </span>
                  <span className="con">
                    <Icon n="x" />
                    Mai puțini oameni scriu primii
                  </span>
                </span>
              </button>
            </div>
            <p className="dest-note">
              {dest === "form"
                ? "Formularul cere doar numele și numărul de telefon. Nimic altceva, ca omul să-l completeze în câteva secunde."
                : st.waAvailable === false
                  ? "Pagina ta de Facebook n-are încă un număr de WhatsApp legat. Îl legi din Pagină → Setări → WhatsApp, sau alegi formularul."
                  : st.waNumber
                    ? `Mesajele vin pe WhatsApp-ul legat de pagină (${st.waNumber}).`
                    : "Numărul de WhatsApp al afacerii trebuie să fie legat de pagina de Facebook. Verificăm noi înainte de lansare."}
            </p>
          </div>

          {!st.hasAdsPlan ? (
            <div className="bill">
              <div className="bill-row">
                <b>Abonament AdPilot</b>
                <span>Azi, apoi automat în fiecare lună. Anulezi oricând.</span>
                <em>495 lei</em>
              </div>
              <div className="bill-row ext">
                <b>Bugetul de reclame</b>
                <span>Direct la Facebook, de pe cardul tău. Nu trece prin noi.</span>
                <em>≈ {fmtLei(month)} lei/lună</em>
              </div>
              <div className="bill-row tot">
                <b>Plătești azi către AdPilot</b>
                <span>&nbsp;</span>
                <em>495 lei</em>
              </div>
            </div>
          ) : null}
        </div>

        <div className="pay-more">
          <div className="box guar">
            <span className="seal">
              <Icon n="shield" />
              Garanție de 30 de zile
            </span>
            <h3>Dacă nu vin cel puțin 20 de cereri în 30 de zile, lucrăm gratis până vin.</h3>
            <small>Condiții: buget de minimum 40 de lei pe zi și campania pornită continuu.</small>
          </div>
          <div className="after">
            <h4>Ce se întâmplă după ce {st.hasAdsPlan ? "pornești" : "plătești"}</h4>
            <ol>
              <li>
                <small>în câteva minute</small>
                <span>Campania pleacă la Facebook, exact cum ai văzut-o.</span>
              </li>
              <li>
                <small>câteva ore</small>
                <span>Facebook o verifică. Te anunțăm pe WhatsApp când e live.</span>
              </li>
              <li>
                <small>de acum</small>
                <span>Fiecare cerere îți vine pe WhatsApp, cu nume și telefon.</span>
              </li>
            </ol>
          </div>
        </div>

        <div className="paybox">
          {st.hasAdsPlan ? (
            <>
              <h3>Pornește campania</h3>
              <p className="secure" style={{ marginTop: 10 }}>
                Abonamentul tău include reclamele, așa că nu plătești nimic acum.
              </p>
              <button
                className="btn btn-ink btn-block"
                onClick={() => void launch()}
                disabled={dest === "wa" && st.waAvailable === false}
              >
                Pornește campania <Icon n="arrow" />
              </button>
            </>
          ) : isOpen ? (
            <>
              <div className="checkout-box">{checkoutElement}</div>
              <button className="btn btn-line btn-block" onClick={closeCheckout}>
                Înapoi
              </button>
            </>
          ) : (
            <>
              <h3>Plată cu cardul</h3>
              <label className="consent" style={{ marginTop: 16 }}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span>
                  Sunt de acord ca AdPilot să pornească serviciul imediat după plată. Am citit{" "}
                  <a className="link-accent" href="/terms-of-service" target="_blank">
                    termenii
                  </a>{" "}
                  și{" "}
                  <a className="link-accent" href="/refund-policy" target="_blank">
                    politica de rambursare
                  </a>
                  .
                </span>
              </label>
              <button className="btn btn-ink btn-block" onClick={() => void pay()}>
                <Icon n="lock" />
                Plătește 495 lei și pornește campania
              </button>
              <p className="secure">
                <Icon n="lock" />
                <span>
                  Plata e procesată de Stripe. AdPilot nu vede datele cardului. Primești chitanța pe
                  email.
                </span>
              </p>
            </>
          )}
          {error && phase !== "failed" ? (
            <p className="hint" style={{ color: "var(--bad)", marginTop: 12 }}>
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </FlowShell>
  );
}
