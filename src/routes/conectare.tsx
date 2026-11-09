import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { startMetaOAuth } from "@/lib/meta-oauth.functions";
import { startTikTokOAuth } from "@/lib/tiktok-oauth.functions";
import { getFlowState, type FlowState } from "@/lib/v3.functions";
import { FlowShell, Icon, Loading, errMsg, useRequireSession, v3Head } from "@/components/v3/ui";

export const Route = createFileRoute("/conectare")({
  head: () =>
    v3Head("Conectează Facebook sau TikTok — AdPilot", undefined, [
      { name: "robots", content: "noindex" },
    ]),
  component: ConnectPage,
});

function ConnectPage() {
  const session = useRequireSession();
  const flow = useServerFn(getFlowState);
  const meta = useServerFn(startMetaOAuth);
  const tiktok = useServerFn(startTikTokOAuth);
  const [state, setState] = useState<FlowState | null>(null);
  const [going, setGoing] = useState<null | "facebook" | "tiktok">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session !== "ok") return;
    flow()
      .then(setState)
      .catch(() => setState(null));
  }, [session, flow]);

  async function go(p: "facebook" | "tiktok") {
    setGoing(p);
    setError(null);
    try {
      const r =
        p === "facebook"
          ? await meta({ data: { returnTo: "/verificare" } })
          : await tiktok({ data: { returnTo: "/verificare" } });
      window.location.href = r.url;
    } catch (e) {
      setError(errMsg(e));
      setGoing(null);
    }
  }

  if (session !== "ok") return <Loading />;
  const connected = state?.metaConnected || state?.tiktokConnected;

  return (
    <FlowShell
      step={1}
      narrow
      helpText="Salut Daniel, nu reușesc să conectez Facebook-ul la AdPilot."
    >
      <h1>Unde vrei să faci reclame?</h1>
      <p className="intro">
        Te ducem pe Facebook sau TikTok ca să alegi pagina și contul de reclame. Nu ne dai nicio
        parolă și nu publicăm nimic fără acordul tău.
      </p>
      {connected ? (
        <div className="go-row">
          <a className="btn btn-ink" href="/verificare">
            Am conectat deja, continuă <Icon n="arrow" />
          </a>
        </div>
      ) : null}
      <div className="choices">
        <button className="choice" onClick={() => void go("facebook")} disabled={!!going}>
          <span className="logos">
            <span>
              <Icon n="fb" />
            </span>
            <span>
              <Icon n="ig" />
            </span>
          </span>
          <span>
            <b>Facebook și Instagram</b>
            <small>Cel mai bun pentru cabinete, saloane și servicii locale</small>
          </span>
          <span className="badge">Recomandat</span>
          <span className="arrow">
            <Icon n="arrow" />
          </span>
        </button>
        <button className="choice" onClick={() => void go("tiktok")} disabled={!!going}>
          <span className="logos">
            <span>
              <Icon n="tt" />
            </span>
          </span>
          <span>
            <b>TikTok</b>
            <small>Bun dacă clienții tăi sunt mai ales sub 35 de ani</small>
          </span>
          <span className="arrow" style={{ marginLeft: "auto" }}>
            <Icon n="arrow" />
          </span>
        </button>
      </div>
      {error ? (
        <p className="hint" style={{ color: "var(--bad)", marginTop: 14 }}>
          {error}
        </p>
      ) : null}
      <div className="assure">
        <div>
          <Icon n="lock" />
          Conectare oficială. Poți deconecta oricând din setările Facebook.
        </div>
        <div>
          <Icon n="eye" />
          Vedem doar pagina și contul de reclame pe care le alegi tu.
        </div>
        <div>
          <Icon n="wa" />
          Nu ai pagină de Facebook? Continuă oricum, îți arătăm ce să faci.
        </div>
      </div>
      {going ? (
        <div className="overlay">
          <div className="modal">
            <div className="spin" />
            <h3>Te ducem la {going === "facebook" ? "Facebook" : "TikTok"}…</h3>
            <p>
              Acolo apeși „Continuă” și bifezi pagina și contul de reclame. Apoi te aducem înapoi
              aici.
            </p>
          </div>
        </div>
      ) : null}
    </FlowShell>
  );
}
