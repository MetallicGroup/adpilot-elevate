import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requestPhoneCode, verifyPhoneCode } from "@/lib/phone-auth.functions";
import { getFlowState, saveSignupBasics } from "@/lib/v3.functions";
import { getStoredReferral } from "@/lib/referral";
import { fbCompleteRegistration } from "@/lib/meta-pixel";
import { tkTrack } from "@/lib/tiktok-pixel";
import { Icon, errMsg } from "./ui";

const digitsOf = (v: string) =>
  v.replace(/\D/g, "").replace(/^40/, "").replace(/^0/, "").slice(0, 9);
const pretty = (d: string) =>
  d
    ? `0${d}`.replace(/^(\d{4})(\d{0,3})(\d{0,3}).*/, (_, a, b, c) =>
        [a, b, c].filter(Boolean).join(" "),
      )
    : "";

/** Unde ajunge omul după ce a intrat. `next` vine din linkurile care cer cont. */
async function routeAfterLogin(next: string | null) {
  if (
    next &&
    /^\/(conectare|verificare|campanie|plata|activare-whatsapp|panou)(\/|\?|$)/.test(next)
  ) {
    window.location.replace(next);
    return;
  }
  try {
    const f = await getFlowState();
    window.location.replace(
      f.liveCount > 0 || f.hasAdsPlan
        ? "/panou"
        : f.metaConnected || f.tiktokConnected
          ? "/campanie"
          : "/conectare",
    );
  } catch {
    window.location.replace("/conectare");
  }
}

export function PhoneAuth({ mode, next }: { mode: "signup" | "login"; next: string | null }) {
  const send = useServerFn(requestPhoneCode);
  const verify = useServerFn(verifyPhoneCode);
  const saveBasics = useServerFn(saveSignupBasics);
  const [step, setStep] = useState<"form" | "code">("form");
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [digits, setDigits] = useState("");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [masked, setMasked] = useState("");

  const phoneOk = /^7\d{8}$/.test(digits);

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && name.trim().length < 2) return setError("Scrie-ne numele tău.");
    if (mode === "signup" && business.trim().length < 2)
      return setError("Scrie-ne numele afacerii.");
    if (!phoneOk) return setError("Numărul trebuie să înceapă cu 07 și să aibă 10 cifre.");
    if (!consent) return setError("Bifează acordul pentru mesajele pe WhatsApp.");
    setBusy(true);
    try {
      const r = await send({ data: { phone: `0${digits}`, consent: true } });
      setMasked(r.masked);
      setStep("code");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    const c = code.replace(/\D/g, "");
    if (c.length !== 6) return setError("Codul are 6 cifre.");
    setBusy(true);
    setError(null);
    try {
      const r = await verify({
        data: { phone: `0${digits}`, code: c, referral: getStoredReferral() },
      });
      const { data: auth, error: vErr } = await supabase.auth.verifyOtp({
        token_hash: r.tokenHash,
        type: "magiclink",
      });
      if (vErr) throw new Error("Nu am putut porni sesiunea. Încearcă din nou.");
      if (r.isNew && auth?.user?.id) {
        fbCompleteRegistration(`reg_${auth.user.id}`);
        tkTrack("CompleteRegistration", {}, `reg_${auth.user.id}`);
      }
      if (mode === "signup" && name.trim() && business.trim()) {
        try {
          await saveBasics({ data: { fullName: name, businessName: business } });
        } catch {
          /* numele se poate completa și mai târziu */
        }
      }
      await routeAfterLogin(mode === "signup" && r.isNew ? "/conectare" : next);
    } catch (err) {
      setError(errMsg(err));
      setCode("");
      setBusy(false);
    }
  }

  if (step === "code")
    return (
      <div className="card">
        <h1>Scrie codul primit</h1>
        <p className="intro">
          L-am trimis pe WhatsApp la <b style={{ color: "#fff" }}>{masked || pretty(digits)}</b>.
        </p>
        <form className="form" onSubmit={submitCode} noValidate>
          <div className="field">
            <label htmlFor="code">Codul de 6 cifre</label>
            <input
              className="input input-code"
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={code}
              autoFocus
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
              }}
            />
          </div>
          {error ? (
            <p className="hint" style={{ color: "var(--bad)" }}>
              {error}
            </p>
          ) : null}
          <button className="btn btn-ink btn-block" type="submit" disabled={busy}>
            {busy ? "Verific…" : "Continuă"} <Icon n="arrow" />
          </button>
        </form>
        <p className="below">
          <button
            type="button"
            className="link-accent"
            style={{ background: "none", border: 0, cursor: "pointer", font: "inherit" }}
            onClick={() => {
              setStep("form");
              setCode("");
              setError(null);
            }}
          >
            Schimbă numărul
          </button>
        </p>
      </div>
    );

  return (
    <div className="card">
      <h1>{mode === "signup" ? "Fă-ți contul" : "Intră în cont"}</h1>
      <p className="intro">
        {mode === "signup"
          ? "Durează 30 de secunde. Nu îți cerem cardul acum."
          : "Fără parolă. Îți trimitem un cod pe WhatsApp."}
      </p>
      <form className="form" onSubmit={submitForm} noValidate>
        {mode === "signup" ? (
          <>
            <div className="field">
              <label htmlFor="r-name">Numele tău</label>
              <input
                className="input"
                id="r-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex. Andrei Popescu"
                autoComplete="name"
              />
            </div>
            <div className="field">
              <label htmlFor="r-biz">Numele afacerii</label>
              <input
                className="input"
                id="r-biz"
                value={business}
                onChange={(e) => setBusiness(e.target.value)}
                placeholder="ex. Clinica Dr. Popescu"
                autoComplete="organization"
              />
            </div>
          </>
        ) : null}
        <div className="field">
          <label htmlFor="r-phone">Numărul tău de WhatsApp</label>
          <input
            className="input"
            id="r-phone"
            type="tel"
            inputMode="tel"
            value={pretty(digits)}
            onChange={(e) => setDigits(digitsOf(e.target.value))}
            placeholder="07xx xxx xxx"
            autoComplete="tel"
          />
          <span className="hint">
            Îți trimitem codul pe WhatsApp. Tot acolo îți vin și clienții.
          </span>
        </div>
        <label className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            Sunt de acord să primesc pe WhatsApp mesaje de la AdPilot: codul de autentificare,
            cererile clienților și informații despre reclamele mele. Mă pot opri oricând.
          </span>
        </label>
        {error ? (
          <p className="hint" style={{ color: "var(--bad)" }}>
            {error}
          </p>
        ) : null}
        <button className="btn btn-ink btn-block" type="submit" disabled={busy}>
          {busy ? "Trimit codul…" : "Trimite codul pe WhatsApp"} <Icon n="arrow" />
        </button>
      </form>
      <p className="below">
        {mode === "signup" ? (
          <>
            Ai deja cont?{" "}
            <a className="link-accent" href="/intra">
              Intră în cont
            </a>
          </>
        ) : (
          <>
            Nu ai cont?{" "}
            <a className="link-accent" href="/cont-nou">
              Fă-ți unul în 30 de secunde
            </a>
          </>
        )}
      </p>
    </div>
  );
}
