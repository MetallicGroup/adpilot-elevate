import { createFileRoute } from "@tanstack/react-router";
import startCss from "../styles/start.css?url";

/** Pagina de după linkul de conectare Facebook trimis pe WhatsApp (fără cont deschis în browser). */
export const Route = createFileRoute("/conectat")({
  validateSearch: (s: Record<string, unknown>): { meta?: string; wa?: string } => ({
    ...(typeof s.meta === "string" ? { meta: s.meta } : {}),
    ...(typeof s.wa === "string" && /^\d{8,15}$/.test(s.wa) ? { wa: s.wa } : {}),
  }),
  head: () => ({
    meta: [{ title: "Conectare Facebook — AdPilot" }, { name: "robots", content: "noindex" }],
    links: [{ rel: "stylesheet", href: startCss }],
  }),
  component: ConnectedPage,
});

function ConnectedPage() {
  const { meta, wa } = Route.useSearch();
  const ok = meta === "connected";
  const expired = meta === "expired";
  return (
    <div className="st">
      <div className="app">
        <header className="top">
          <a className="logo" href="/">
            <img src="/adpilot-icon.png" alt="" />
            AdPilot
          </a>
        </header>
        <section className="screen" aria-labelledby="h-conn">
          <div className="q">
            <div className="qmain">
              <p className="eyebrow">{ok ? "Gata" : "Conectare Facebook"}</p>
              <h1 id="h-conn">
                {ok ? (
                  <>
                    Facebook-ul e <span className="grad">conectat</span> ✅
                  </>
                ) : expired ? (
                  "Linkul a expirat"
                ) : (
                  "Conectarea n-a mers"
                )}
              </h1>
              <p className="lead">
                {ok
                  ? "Întoarce-te pe WhatsApp: robotul AdPilot continuă de acolo cu reclama ta."
                  : expired
                    ? "Scrie-i robotului pe WhatsApp „trimite-mi linkul de Facebook” și îți trimite unul nou."
                    : "Încearcă din nou din linkul primit pe WhatsApp sau cere robotului unul nou. Asigură-te că apeși „Continuă” și bifezi pagina și contul de reclame."}
              </p>
              <a className="btn" href={`https://wa.me/${wa ?? ""}`}>
                Înapoi pe WhatsApp
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
