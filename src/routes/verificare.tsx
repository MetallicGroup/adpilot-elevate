import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  getAccountCheck,
  getFlowState,
  type AccountCheck,
  type CheckProblem,
} from "@/lib/v3.functions";
import { FlowShell, Icon, Loading, help, useRequireSession, v3Head } from "@/components/v3/ui";

export const Route = createFileRoute("/verificare")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { meta?: string; tiktok?: string; reason?: string } => ({
    meta: typeof s.meta === "string" ? s.meta : undefined,
    tiktok: typeof s.tiktok === "string" ? s.tiktok : undefined,
    reason: typeof s.reason === "string" ? s.reason : undefined,
  }),
  head: () =>
    v3Head("Verificăm contul — AdPilot", undefined, [{ name: "robots", content: "noindex" }]),
  component: VerifyPage,
});

function VerifyPage() {
  const session = useRequireSession();
  const { meta, tiktok } = Route.useSearch();
  const check = useServerFn(getAccountCheck);
  const flow = useServerFn(getFlowState);
  const [data, setData] = useState<AccountCheck | null>(null);
  const [who, setWho] = useState({ name: "", business: "" });
  const [shown, setShown] = useState(0);
  const [failed, setFailed] = useState(false);

  const run = useCallback(
    async (force: boolean) => {
      setData(null);
      setShown(0);
      setFailed(false);
      try {
        const d = await check({ data: { force } });
        setData(d);
      } catch {
        setFailed(true);
      }
    },
    [check],
  );

  useEffect(() => {
    if (session !== "ok") return;
    void run(true);
    flow()
      .then((f) => setWho({ name: f.name, business: f.businessName }))
      .catch(() => {});
  }, [session, run, flow]);

  // Rândurile apar pe rând, ca omul să vadă ce verificăm.
  useEffect(() => {
    if (!data || shown >= data.items.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), 480);
    return () => clearTimeout(t);
  }, [data, shown]);

  if (session !== "ok") return <Loading />;
  const platform = data?.platform === "tiktok" || tiktok === "connected" ? "TikTok" : "Facebook";
  const connectError = meta === "error" || tiktok === "error";

  if (connectError || data?.problem === "connect")
    return (
      <FlowShell step={1} narrow>
        <h1>Conectarea n-a mers</h1>
        <p className="intro">
          Încearcă din nou și, pe pagina {platform}, apasă „Continuă” și bifează pagina și contul de
          reclame. Dacă tot nu merge, scrie-i lui Daniel.
        </p>
        <div className="go-row">
          <a className="btn btn-ink" href="/conectare">
            Încearcă din nou <Icon n="arrow" />
          </a>
          <a
            className="btn btn-wa"
            href={help(
              "Salut Daniel, am încercat să conectez Facebook-ul la AdPilot și nu a mers.",
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon n="wa" />
            Scrie-i lui Daniel
          </a>
        </div>
      </FlowShell>
    );

  const done = !!data && shown >= data.items.length;
  const items = data?.items ?? [
    { k: "page", label: "Pagina de Facebook", ok: false, detail: "" },
    { k: "acct", label: "Contul de reclame", ok: false, detail: "" },
    { k: "card", label: "Cardul pentru reclame", ok: false, detail: "" },
    { k: "terms", label: "Condițiile pentru formulare", ok: false, detail: "" },
  ];
  const blocking = data?.problem && data.problem !== "terms";

  return (
    <FlowShell step={1} narrow>
      <h1>
        {!done
          ? `Verificăm contul tău de ${platform}`
          : data?.problem
            ? "Mai e un singur lucru de rezolvat"
            : "Totul e în regulă ✓"}
      </h1>
      <p className="intro">
        {!done
          ? `Ca reclama să pornească fără surprize, ne uităm acum la tot ce cere ${platform}.`
          : data?.problem
            ? "Restul e în regulă. Rezolvă pasul de mai jos și continuăm."
            : `${who.business || "Afacerea ta"} e gata de reclame. Urmează partea ușoară.`}
      </p>
      {failed ? (
        <div className="fix">
          <h3>Nu am putut verifica acum</h3>
          <p>Facebook a răspuns greu. Mai încearcă o dată.</p>
          <div className="acts">
            <button className="btn btn-line" onClick={() => void run(true)}>
              Verifică din nou
            </button>
          </div>
        </div>
      ) : null}
      <div className="vlist">
        {items.map((it, i) => {
          const visible = !!data && i < shown;
          const cls = !visible ? "wait" : it.ok ? "ok" : "bad";
          return (
            <div key={it.k} className={`vitem ${cls}`}>
              <span className="st">
                {!visible ? (
                  <span className="mini-spin" />
                ) : it.ok ? (
                  <Icon n="check" />
                ) : (
                  <Icon n="x" />
                )}
              </span>
              <b>{it.label}</b>
              <em>{visible ? it.detail : "Se verifică…"}</em>
            </div>
          );
        })}
      </div>
      {done && data?.problem ? (
        <FixBlock
          problem={data.problem}
          links={data.links}
          who={who}
          platform={platform}
          onRecheck={() => void run(true)}
        />
      ) : null}
      {done && !blocking ? (
        <div className="go-row">
          <a className="btn btn-ink" href="/campanie">
            {data?.problem === "terms" ? "Continuă oricum" : "Fă campania"} <Icon n="arrow" />
          </a>
          <span className="note">Durează cam 3 minute.</span>
        </div>
      ) : null}
    </FlowShell>
  );
}

function FixBlock(props: {
  problem: Exclude<CheckProblem, null>;
  links: AccountCheck["links"];
  who: { name: string; business: string };
  platform: string;
  onRecheck: () => void;
}) {
  const { problem, links, who, platform } = props;
  const me = `sunt ${who.name || "[numele meu]"} de la ${who.business || "[afacerea mea]"}`;
  const msg: Record<string, string> = {
    nopage: `Salut Daniel, ${me}. Vreau să pornesc reclame cu AdPilot, dar nu am pagină de ${platform}. Mă ajuți?`,
    noacct: `Salut Daniel, ${me}. Am conectat ${platform}-ul, dar nu am cont de reclame. Mă ajuți să-l fac?`,
    disabled: `Salut Daniel, ${me}. Contul meu de reclame e dezactivat de ${platform} și nu știu cum să-l repun. Mă ajuți?`,
    unsettled: `Salut Daniel, ${me}. Contul de reclame are o plată neachitată și nu pot porni reclame. Ce fac?`,
    nocard: `Salut Daniel, ${me}. Nu reușesc să adaug cardul în contul de reclame ${platform}. Mă ajuți?`,
    terms: `Salut Daniel, ${me}. Nu reușesc să accept condițiile pentru formulare pe Facebook. Mă ajuți?`,
    connect: `Salut Daniel, ${me}. Nu reușesc să conectez ${platform}-ul. Mă ajuți?`,
  };
  const daniel = (
    <a className="btn btn-wa" href={help(msg[problem])} target="_blank" rel="noopener noreferrer">
      <Icon n="wa" />
      Scrie-i lui Daniel pe WhatsApp
    </a>
  );
  const recheck = (
    <button className="btn btn-line" onClick={props.onRecheck}>
      Am rezolvat, verifică din nou
    </button>
  );
  const ext = (href: string | undefined, label: string, ink = true) =>
    href ? (
      <a
        className={`btn ${ink ? "btn-ink" : "btn-line"}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </a>
    ) : null;
  const body: Record<string, { h: string; p: string; a: ReactNode }> = {
    nopage: {
      h: `Îți trebuie o pagină de ${platform}`,
      p: "Facebook nu lasă reclame fără o pagină. O faci în 2 minute din aplicația Facebook: Meniu → Pagini → Creează.",
      a: (
        <>
          {ext(links.page, "Fă pagina acum")}
          {recheck}
          {daniel}
        </>
      ),
    },
    noacct: {
      h: "Îți trebuie un cont de reclame",
      p: "Fără cont de reclame, Facebook nu poate porni campania. Daniel ți-l face împreună cu tine, în câteva minute.",
      a: (
        <>
          {daniel}
          {recheck}
        </>
      ),
    },
    disabled: {
      h: `${platform} ți-a dezactivat contul de reclame`,
      p: "Uneori se poate contesta, alteori e mai simplu să facem un cont nou. Aici te ajută un om, nu un robot: îi scrii lui Daniel, iar mesajul e deja scris.",
      a: (
        <>
          {daniel}
          {ext(links.quality, "Vezi de ce l-a dezactivat", false)}
        </>
      ),
    },
    unsettled: {
      h: "Contul de reclame are o plată neachitată",
      p: "Facebook nu pornește reclame noi până nu se achită suma restantă. O plătești din setările de facturare ale contului.",
      a: (
        <>
          {ext(links.card, "Deschide facturarea")}
          {recheck}
          {daniel}
        </>
      ),
    },
    nocard: {
      h: "Adaugă un card în contul de reclame",
      p: `${platform} ia banii pentru reclame direct de pe cardul tău. Fără card, reclama nu poate porni. AdPilot nu vede și nu atinge acești bani.`,
      a: (
        <>
          {ext(links.card, "Adaugă cardul")}
          {recheck}
          {daniel}
        </>
      ),
    },
    terms: {
      h: "Acceptă condițiile pentru formulare",
      p: "E un singur „Accept” pe care Facebook îl cere o dată, ca să poți primi nume și telefon printr-un formular. Deschide linkul de pe calculator, apasă „Creează formular”, apoi „Accept”.",
      a: (
        <>
          {ext(links.terms, "Acceptă condițiile")}
          {recheck}
          {daniel}
        </>
      ),
    },
    connect: {
      h: "Conectează contul",
      p: "",
      a: (
        <a className="btn btn-ink" href="/conectare">
          Conectează
        </a>
      ),
    },
  };
  const b = body[problem];
  return (
    <div className="fix">
      <h3>{b.h}</h3>
      <p>{b.p}</p>
      <div className="acts">{b.a}</div>
      <div className="prefill">
        <small>Mesajul care i se trimite lui Daniel</small>
        <div className="msg out on">{msg[problem]}</div>
      </div>
    </div>
  );
}
