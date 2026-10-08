import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { Ribbon } from "./Ribbon";
import { PUBLIC_PLANS, type PublicPlan } from "./plans";

const reducedMotion = () =>
  typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Scroll reveals for [data-r] elements inside `ref`. Everything is visible at rest;
 * only elements below the fold wait, then slide in when they enter the viewport.
 */
export function useReveal(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root || reducedMotion()) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.remove("r-wait");
          io.unobserve(e.target);
        }),
      { rootMargin: "0px 0px -8% 0px" },
    );
    root.querySelectorAll<HTMLElement>("[data-r]").forEach((el) => {
      if (el.getBoundingClientRect().top > window.innerHeight * 0.92) el.classList.add("r-wait");
      io.observe(el);
    });
    return () => io.disconnect();
  }, [ref]);
}

const NAV_LINKS = [
  { to: "/features", label: "Funcționalități" },
  { to: "/pricing", label: "Prețuri" },
  { to: "/about", label: "Despre" },
  { to: "/contact", label: "Contact" },
] as const;

export function V2Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={`nav ${scrolled || open ? "on" : ""}`}>
      <div className="in">
        <Link to="/" className="brand">
          <span className="logo" />
          AdPilot
        </Link>
        <nav className="links">
          {NAV_LINKS.map((l) => (
            <Link key={l.to} to={l.to}>
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="sp" />
        <Link to="/auth" search={{ mode: "signin" }} className="login btn btn-s btn-o dark">
          Intră în cont
        </Link>
        <Link to="/auth" search={{ mode: "signup" }} className="btn btn-s btn-w">
          Începe gratuit
        </Link>
        <button type="button" className="burger" aria-label="Meniu" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span />
          <span />
        </button>
      </div>
      {open && (
        <nav className="mmenu">
          {NAV_LINKS.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <Link to="/auth" search={{ mode: "signin" }} onClick={() => setOpen(false)}>
            Intră în cont
          </Link>
        </nav>
      )}
    </header>
  );
}

/** Page shell for public pages: v2 nav, content, and the existing legal footer. */
export function V2Shell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref);
  return (
    <div className="v2 mk" ref={ref}>
      <V2Nav />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

export function Band({
  tone,
  id,
  className = "",
  children,
}: {
  tone: "dark" | "light";
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`band ${tone} ${className}`} id={id}>
      <div className="wrap">{children}</div>
    </section>
  );
}

/** Dark page opener with the gradient ribbon. `aside` sits to the right on desktop. */
export function Hero({
  eyebrow,
  title,
  sub,
  children,
  aside,
}: {
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className={`band dark phero ${aside ? "split" : ""}`}>
      <Ribbon />
      <div className="grain" />
      <div className="wrap">
        <div className="phero-copy">
          {eyebrow && <p className="ey">{eyebrow}</p>}
          <h1 className="d2">{title}</h1>
          {sub && <p className="lead">{sub}</p>}
          {children}
        </div>
        {aside && <div className="phero-aside">{aside}</div>}
      </div>
    </section>
  );
}

export function SignupButton({ label = "Începe gratuit 7 zile", tone = "w", onClick }: { label?: string; tone?: "w" | "k" | "g"; onClick?: () => void }) {
  return (
    <Link to="/auth" search={{ mode: "signup" }} className={`btn btn-${tone}`} onClick={onClick}>
      {label} <span className="arr">→</span>
    </Link>
  );
}

/** The three plans: 0 lei up front, real price struck through, what's included. */
export function PlanCards({ onSelect }: { onSelect?: (plan: PublicPlan) => void }) {
  return (
    <div className="plans">
      {PUBLIC_PLANS.map((p, i) => {
        const tone = p.featured ? "w" : p.free ? "o" : "k";
        return (
          <div key={p.id} className={`plan ${p.featured ? "hot" : ""}`} data-r style={{ ["--d" as string]: `${i * 0.08}s` }}>
            <span className="tag">{p.tag}</span>
            <div className="nm">{p.name}</div>
            <div className="pr">
              <span className="z">0 lei</span> {p.price && <s>{p.price}</s>}
            </div>
            <div className="then">{p.then}</div>
            <ul>
              {p.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
            {onSelect ? (
              <button type="button" className={`btn btn-${tone}`} style={{ justifyContent: "center" }} onClick={() => onSelect(p)}>
                {p.cta}
              </button>
            ) : (
              <Link to="/auth" search={{ mode: "signup" }} className={`btn btn-${tone}`} style={{ justifyContent: "center" }}>
                {p.cta}
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="faq" data-r>
      {items.map((f, i) => (
        <details key={f.q} open={i === 0}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function FinalCta({ title, label, onClick }: { title: ReactNode; label?: string; onClick?: () => void }) {
  return (
    <section className="band dark final fin">
      <Ribbon style={{ top: "auto", bottom: "-40%" }} />
      <div className="grain" />
      <div className="wrap">
        <h2 className="d1" data-r>
          {title}
        </h2>
        <div className="cta" data-r>
          <SignupButton label={label} onClick={onClick} />
        </div>
      </div>
    </section>
  );
}

export type ChatLine = { from: "me" | "bot"; text: string };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * A phone playing a WhatsApp conversation with AdPilot on a loop: the user's lines
 * are typed in the message field and sent, the assistant's arrive after a typing dot.
 */
export function ChatPhone({ lines }: { lines: ChatLine[] }) {
  const body = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const b = body.current;
    const f = input.current;
    if (!b || !f) return;
    let alive = true;

    const bubble = (l: ChatLine) => {
      const d = document.createElement("div");
      d.className = `wb ${l.from === "me" ? "out" : "in"}`;
      d.textContent = l.text;
      const t = document.createElement("time");
      t.textContent = "9:41";
      d.append(t);
      b.append(d);
    };

    b.classList.add("static");
    b.replaceChildren();
    lines.forEach(bubble);
    if (reducedMotion()) return;

    (async () => {
      await sleep(2800);
      while (alive) {
        b.classList.remove("static");
        b.replaceChildren();
        for (const l of lines) {
          if (!alive) return;
          if (l.from === "me") {
            await sleep(500);
            f.classList.add("typing");
            for (const ch of l.text) {
              if (!alive) return;
              f.textContent += ch;
              await sleep(24);
            }
            await sleep(300);
            f.textContent = "";
            f.classList.remove("typing");
          } else {
            const dots = document.createElement("div");
            dots.className = "wtyp";
            dots.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
            b.append(dots);
            await sleep(850);
            dots.remove();
          }
          if (!alive) return;
          bubble(l);
          await sleep(650);
        }
        await sleep(4200);
      }
    })();

    return () => {
      alive = false;
    };
  }, [lines]);

  return (
    <div className="iph">
      <div className="bz">
        <div className="scr">
          <div className="sbar">
            <span>9:41</span>
          </div>
          <div className="island" />
          <div className="appl wa">
            <div className="hd">
              <span className="logo" />
              <div style={{ flex: 1 }}>
                <b>AdPilot</b>
                <small>online</small>
              </div>
            </div>
            <div className="body" ref={body} />
            <div className="inp">
              <div className="f" ref={input} />
              <div className="s">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 20l18-8L3 4v6l11 2-11 2z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="glare" />
        </div>
      </div>
    </div>
  );
}
