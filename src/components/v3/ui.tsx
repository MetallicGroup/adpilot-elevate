import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import v3Css from "@/styles/v3.css?url";

export const logoUrl = "/adpilot-icon.png";

/** Numărul de WhatsApp unde ajung cererile de ajutor (al lui Daniel). */
export const SUPPORT_WA = "40733342513";
export const waLink = (num: string, text: string) =>
  `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
export const help = (text: string) => waLink(SUPPORT_WA, text);

/** Head-ul comun: stilul v3 și fontul brandului. */
export function v3Head(
  title: string,
  description?: string,
  extra: Array<Record<string, string>> = [],
) {
  return {
    meta: [
      { title },
      ...(description ? [{ name: "description", content: description }] : []),
      ...extra,
    ],
    links: [
      { rel: "stylesheet", href: v3Css },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=DM+Mono:wght@400;500&display=swap",
      },
    ],
  };
}

/* ---------- Iconițe ---------- */
const ICONS = {
  arrow:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>',
  check:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>',
  x: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>',
  plus: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>',
  lock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="10" height="7" rx="1.6"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg>',
  eye: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>',
  upload:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
  bulb: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 13h4M6.5 15h3M8 1.5a4.5 4.5 0 00-2.6 8.2c.4.3.6.7.6 1.2v.6h4v-.6c0-.5.2-.9.6-1.2A4.5 4.5 0 008 1.5z"/></svg>',
  shield:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8 1.5l5.5 2v4.2c0 3.2-2.3 5.8-5.5 6.8-3.2-1-5.5-3.6-5.5-6.8V3.5l5.5-2z"/><path d="M5.5 8l1.8 1.8L10.8 6.3" stroke-linecap="round"/></svg>',
  megaphone:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M3 8v4h3l6 4V4L6 8H3z"/><path d="M15 7.5a3.5 3.5 0 010 5" stroke-linecap="round"/></svg>',
  users:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="7" r="3"/><path d="M2.5 16.5c.6-2.8 2.8-4.5 5.5-4.5s4.9 1.7 5.5 4.5"/><path d="M13 4.2a3 3 0 010 5.6M15.5 12.4c1 .7 1.7 2.1 2 4.1"/></svg>',
  card: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="4.5" width="15" height="11" rx="2"/><path d="M2.5 8h15"/></svg>',
  gear: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" stroke-linecap="round"/></svg>',
  form: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3.5" y="2.5" width="13" height="15" rx="2.5"/><path d="M7 7h6M7 10.5h6M7 14h3.5"/></svg>',
  fb: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#1877F2"/><path d="M13.3 19.6v-6.4h2.2l.3-2.5h-2.5V9.1c0-.7.2-1.2 1.3-1.2h1.3V5.7c-.2 0-1-.1-2-.1-2 0-3.3 1.2-3.3 3.4v1.8H8.4v2.5h2.2v6.4h2.7z" fill="#fff"/></svg>',
  ig: '<svg viewBox="0 0 24 24" fill="none"><defs><linearGradient id="igg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#f9a23c"/><stop offset=".5" stop-color="#e1306c"/><stop offset="1" stop-color="#7a3cf0"/></linearGradient></defs><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="url(#igg)" stroke-width="2"/><circle cx="12" cy="12" r="4.3" stroke="url(#igg)" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.2" fill="#e1306c"/></svg>',
  tt: '<svg viewBox="0 0 24 24"><path d="M16.6 5.6a4.3 4.3 0 01-1-2.8h-3.1v12.5a2.6 2.6 0 11-2.6-2.6c.3 0 .5 0 .8.1V9.6a5.8 5.8 0 105 5.7V9.1a7.3 7.3 0 004.3 1.4V7.4a4.3 4.3 0 01-3.4-1.8z" fill="#111"/></svg>',
  wa: '<svg viewBox="0 0 24 24"><path d="M12 2.2a9.8 9.8 0 00-8.4 14.8L2.3 21.7l4.8-1.3A9.8 9.8 0 1012 2.2z" fill="#25D366"/><path d="M8.7 7.2c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-.9.9-.9 2.2s.9 2.6 1.1 2.8c.1.2 1.8 2.9 4.5 4 2.2.9 2.7.7 3.1.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3l-1.7-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.3-.1-1.1-.4-2-1.3-.8-.7-1.3-1.5-1.4-1.8-.2-.3 0-.4.1-.5l.4-.4.2-.4v-.4l-.9-2.4z" fill="#fff"/></svg>',
} as const;
export type IconName = keyof typeof ICONS;

/** Iconiță SVG statică; `display: contents` o lasă să se așeze ca un copil direct al butonului. */
export function Icon({ n }: { n: IconName }) {
  return (
    <span
      style={{ display: "contents" }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[n] }}
    />
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <a className="logo" href={href}>
      <img src={logoUrl} alt="" />
      <span>AdPilot</span>
    </a>
  );
}

/* ---------- Cadrul paginilor din flux ---------- */
export const STEPS = ["Cont", "Conectare", "Campanie", "Plată", "WhatsApp"] as const;

export function FlowShell({
  step,
  narrow,
  children,
  helpText,
}: {
  step: number;
  narrow?: boolean;
  children: ReactNode;
  helpText?: string;
}) {
  return (
    <div className="v3">
      <header className="app-top">
        <div className="wrap app-top-in">
          <Logo />
          <ol className="stepper" aria-label="Pașii">
            {STEPS.map((s, i) => (
              <li key={s} className={i < step ? "done" : i === step ? "cur" : ""}>
                <span className="n">{i < step ? <Icon n="check" /> : i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <p className="stepper-m">
            <b>{step + 1}</b>/5 · {STEPS[step]}
          </p>
          <a
            className="help"
            href={help(
              helpText ??
                `Salut Daniel, am nevoie de ajutor la pasul „${STEPS[step]}” din AdPilot.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon n="wa" />
            <span>Ajutor</span>
          </a>
        </div>
      </header>
      <main className={`page${narrow ? " page-narrow" : ""}`}>{children}</main>
    </div>
  );
}

/** Pagina cere cont: dacă nu e logat, îl trimitem la intrare și apoi înapoi aici. */
export function useRequireSession(): "loading" | "ok" {
  const [state, setState] = useState<"loading" | "ok">("loading");
  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      if (data.session) setState("ok");
      else {
        const next = window.location.pathname + window.location.search;
        window.location.replace(`/intra?next=${encodeURIComponent(next)}`);
      }
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}

export function Loading({ text = "Se încarcă…" }: { text?: string }) {
  return (
    <div className="v3">
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spin" />
          <p style={{ marginTop: 16, color: "var(--muted)" }}>{text}</p>
        </div>
      </div>
    </div>
  );
}

export function errMsg(e: unknown): string {
  const m = (e as Error)?.message ?? "";
  return m && m.length < 300 ? m : "A apărut o eroare. Încearcă din nou.";
}

export const fmtLei = (n: number) => Math.round(n).toLocaleString("ro-RO");
export const fmtLei2 = (n: number) =>
  n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const initials = (s: string) =>
  (s || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "AP";

/** 07xx xxx xxx → 40 7xx xxx xxx pentru wa.me. */
export function waDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("40")) return d;
  if (d.startsWith("0")) return `4${d}`;
  return d;
}

/* ---------- Reclama de Facebook / Instagram ---------- */
export function AdPreview(props: {
  place: "facebook" | "instagram";
  pageName: string;
  text: string;
  headline: string;
  mediaUrl: string | null;
  mediaIsVideo: boolean;
  dest: "form" | "wa";
  city: string;
}) {
  const { place, pageName, text, headline, mediaUrl, mediaIsVideo, dest } = props;
  const cta = dest === "wa" ? "Trimite mesaj" : "Înscrie-te";
  const media = mediaUrl ? (
    mediaIsVideo ? (
      <video className="ad-img" src={mediaUrl} muted autoPlay loop playsInline />
    ) : (
      <img className="ad-img" src={mediaUrl} alt="" />
    )
  ) : (
    <div
      className="ad-img"
      style={{ display: "grid", placeItems: "center", color: "#8a8d91", fontSize: 13 }}
    >
      Poza sau clipul tău apare aici
    </div>
  );
  if (place === "instagram") {
    const handle = pageName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.|\.$/g, "");
    return (
      <div className="adcard">
        <div className="ig-head">
          <div className="ad-av">{initials(pageName)}</div>
          <div>
            <b>{handle}</b>
            <small>Sponsorizat</small>
          </div>
        </div>
        {media}
        <div className="ig-bar">
          <span>{cta}</span>
          <Icon n="arrow" />
        </div>
        <div className="ig-cap">
          <b>{handle}</b>
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="adcard">
      <div className="ad-head">
        <div className="ad-av">{initials(pageName)}</div>
        <div>
          <div className="ad-name">{pageName}</div>
          <div className="ad-sub">Sponsorizat · {props.city}</div>
        </div>
      </div>
      <div className="ad-text">{text}</div>
      {media}
      <div className="ad-bar">
        <div>
          <small>{dest === "wa" ? "WhatsApp" : "Formular"}</small>
          <b>{headline}</b>
        </div>
        <span className="ad-cta">{cta}</span>
      </div>
    </div>
  );
}

export function FormPreview({ dest, what }: { dest: "form" | "wa"; what: string }) {
  if (dest === "wa")
    return (
      <div className="pform">
        <small>Când apasă „Trimite mesaj”, se deschide WhatsApp-ul afacerii cu mesajul:</small>
        <div className="msg out on" style={{ maxWidth: "100%" }}>
          Bună ziua! Aș dori mai multe informații despre {what || "oferta voastră"}.
        </div>
      </div>
    );
  return (
    <div className="pform">
      <small>Când apasă „Înscrie-te”, omul vede doar două câmpuri:</small>
      <div className="pf">Nume și prenume</div>
      <div className="pf">Număr de telefon</div>
      <div className="pf-btn">Trimite</div>
    </div>
  );
}

/** Ofertă + oraș → textul reclamei, scris ca de un om. */
export function autoText(what: string, offer: string, city: string, dest: "form" | "wa" = "form") {
  const o = offer.trim() ? ` ${offer.trim()}` : "";
  const w = what.trim() || "Serviciul tău";
  const c = city.trim() || "orașul tău";
  return dest === "wa"
    ? `${w}${o}, în ${c}. Scrie-ne pe WhatsApp și îți răspundem imediat, cu toate detaliile.`
    : `${w}${o}, în ${c}. Lasă-ne numele și telefonul și te sunăm noi să stabilim programarea, la ora care îți convine.`;
}
