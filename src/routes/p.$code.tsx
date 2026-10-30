import { createFileRoute } from "@tanstack/react-router";
import { getCampaignPreview } from "@/lib/campaign-preview.functions";

export const Route = createFileRoute("/p/$code")({
  loader: ({ params }) => getCampaignPreview({ data: { code: params.code } }),
  head: () => ({ meta: [{ title: "Previzualizarea reclamei — AdPilot" }, { name: "robots", content: "noindex" }] }),
  component: PreviewPage,
});

function PreviewPage() {
  const d = Route.useLoaderData();
  if (!d) {
    return (
      <main style={wrap}>
        <h1 style={h1}>Previzualizarea nu mai există</h1>
        <p style={muted}>Cere asistentului AdPilot pe WhatsApp un link nou.</p>
      </main>
    );
  }
  const isLeads = d.objective === "leads";
  return (
    <main style={wrap}>
      <p style={eyebrow}>Previzualizare AdPilot</p>
      <h1 style={h1}>Așa va arăta reclama ta</h1>
      <p style={muted}>Exact ca în feed-ul de Facebook. Dacă vrei să schimbi ceva, scrie-i asistentului pe WhatsApp.</p>

      <section style={{ marginTop: 20 }}>
        <p style={label}>1 · Reclama</p>
        {d.previewUrl ? (
          <iframe
            title="Previzualizarea reclamei"
            src={d.previewUrl}
            style={{ width: "100%", maxWidth: 520, height: 720, border: 0, borderRadius: 16, background: "#fff" }}
            scrolling="no"
          />
        ) : (
          <div style={card}>
            <div style={{ padding: 20 }}>
              <b>{d.headline}</b>
              <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{d.primaryText}</p>
            </div>
          </div>
        )}
      </section>

      {isLeads && (
        <section style={{ marginTop: 28 }}>
          <p style={label}>2 · Formularul (se deschide la click pe buton)</p>
          <div style={card}>
            <div style={head}>
              <div style={avatar}>{(d.pageName ?? "A").trim().charAt(0).toUpperCase()}</div>
              <b>{d.pageName ?? "Pagina ta"}</b>
            </div>
            {d.formIntro && (
              <div style={{ padding: "18px 20px", borderBottom: "1px solid #e6e8ee" }}>
                <b style={{ fontSize: 17 }}>{d.headline}</b>
                <p style={{ ...muted, marginTop: 6, whiteSpace: "pre-wrap" }}>{d.formIntro}</p>
              </div>
            )}
            <div style={{ padding: 20 }}>
              <Field label="Nume complet" hint="Completat automat din Facebook" />
              <Field label="Număr de telefon" hint="Completat automat din Facebook" />
              {d.questions.map((q, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={qLabel}>{q.label}</div>
                  {q.type === "choice" && q.options?.length ? (
                    q.options.map((o) => (
                      <div key={o} style={option}>
                        <span style={radio} />
                        {o}
                      </div>
                    ))
                  ) : (
                    <div style={input}>Răspunsul tău</div>
                  )}
                </div>
              ))}
              <div style={button}>Trimite</div>
            </div>
          </div>

          <p style={{ ...label, marginTop: 20 }}>3 · După trimitere</p>
          <div style={{ ...card, textAlign: "center", padding: "32px 20px" }}>
            <div style={check}>✓</div>
            <b style={{ fontSize: 20 }}>Mulțumim!</b>
            <p style={muted}>Te contactăm în cel mai scurt timp. Dacă vrei să stabilim mai repede, scrie-ne direct pe WhatsApp.</p>
            <div style={{ ...button, marginTop: 16, background: "#1fbf5f" }}>Scrie-ne pe WhatsApp</div>
            <p style={{ ...muted, fontSize: 13 }}>Deschide chatul cu tine, cu mesajul deja scris.</p>
          </div>
        </section>
      )}

      {d.destination && (
        <section style={{ marginTop: 28 }}>
          <p style={label}>2 · La click pe „Trimite mesaj”</p>
          <div style={{ ...card, padding: "24px 20px", textAlign: "center" }}>
            <b style={{ fontSize: 18 }}>
              Se deschide direct chatul pe{" "}
              {d.destination === "WHATSAPP" ? "WhatsApp" : d.destination === "INSTAGRAM_DIRECT" ? "Instagram" : "Messenger"}
            </b>
            <p style={muted}>Fără formular: omul îți scrie, iar tu îi răspunzi și îl programezi.</p>
          </div>
        </section>
      )}

      <p style={{ ...muted, fontSize: 13, marginTop: 24 }}>
        Previzualizarea reclamei vine direct de la Facebook. Formularul e redat de AdPilot cu exact întrebările tale;
        pe Facebook aspectul poate diferi puțin.
      </p>
    </main>
  );
}

function Field({ label: l, hint }: { label: string; hint: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={qLabel}>{l}</div>
      <div style={input}>{hint}</div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  maxWidth: 560,
  margin: "0 auto",
  padding: "28px 16px 48px",
  fontFamily: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  color: "#111",
  background: "#f3f4f8",
  minHeight: "100vh",
};
const eyebrow: React.CSSProperties = { fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#6b3dff" };
const h1: React.CSSProperties = { fontSize: 26, fontWeight: 800, margin: "6px 0 6px" };
const muted: React.CSSProperties = { color: "#5b5870", fontSize: 15, lineHeight: 1.45 };
const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#5b5870", marginBottom: 10 };
const card: React.CSSProperties = { background: "#fff", borderRadius: 18, boxShadow: "0 8px 24px rgba(20,20,60,.08)", overflow: "hidden" };
const head: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid #e6e8ee" };
const avatar: React.CSSProperties = { width: 36, height: 36, borderRadius: "50%", background: "#2f6bff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 };
const qLabel: React.CSSProperties = { fontSize: 15, fontWeight: 600, marginBottom: 6 };
const input: React.CSSProperties = { border: "1px solid #ccd0d5", borderRadius: 10, padding: "11px 12px", color: "#8a8d91", background: "#fafbfc", fontSize: 15 };
const option: React.CSSProperties = { border: "1px solid #ccd0d5", borderRadius: 10, padding: "10px 12px", marginBottom: 7, display: "flex", alignItems: "center", gap: 10, fontSize: 15 };
const radio: React.CSSProperties = { width: 16, height: 16, borderRadius: "50%", border: "2px solid #8a8d91", flexShrink: 0 };
const button: React.CSSProperties = { background: "#1877f2", color: "#fff", textAlign: "center", borderRadius: 10, padding: "12px", fontWeight: 700 };
const check: React.CSSProperties = { width: 56, height: 56, borderRadius: "50%", background: "#1fbf5f", color: "#fff", fontSize: 30, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" };
