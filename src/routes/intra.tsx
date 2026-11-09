import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo, help, v3Head, Icon } from "@/components/v3/ui";
import { PhoneAuth } from "@/components/v3/PhoneAuth";

const NEXT = new Set(["/start", "/upgrade", "/materiale"]);

/** Pasul din browser al linkului personal: pornește sesiunea și merge mai departe. */
export const Route = createFileRoute("/intra")({
  validateSearch: (s: Record<string, unknown>): { h?: string; next?: string } => ({
    h: typeof s.h === "string" ? s.h : undefined,
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  head: () =>
    v3Head("Intră în cont — AdPilot", undefined, [{ name: "robots", content: "noindex" }]),
  component: Enter,
});

function Enter() {
  const { h, next } = Route.useSearch();
  // Fără token: formularul de intrare cu codul pe WhatsApp.
  if (!h) return <LoginV3 next={next ?? null} />;
  return <EnterWithToken h={h} next={next} />;
}

function LoginV3({ next }: { next: string | null }) {
  return (
    <div className="v3">
      <header className="app-top">
        <div className="wrap app-top-in">
          <Logo />
          <a
            className="help"
            href={help("Salut Daniel, nu reușesc să intru în contul AdPilot.")}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon n="wa" />
            <span>Ajutor</span>
          </a>
        </div>
      </header>
      <main className="page" style={{ maxWidth: 520 }}>
        <PhoneAuth mode="login" next={next} />
      </main>
    </div>
  );
}

function EnterWithToken({ h, next }: { h: string; next?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const to = next && NEXT.has(next) ? next : "/start";
    supabase.auth
      .verifyOtp({ token_hash: h, type: "magiclink" })
      .then(({ error }) => {
        if (error) throw error;
        window.location.replace(to);
      })
      .catch(() => setFailed(true));
  }, [h, next]);
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        textAlign: "center",
      }}
    >
      {failed ? (
        <p>
          Linkul nu mai merge. <a href="/intra">Intră cu numărul tău de WhatsApp</a>.
        </p>
      ) : (
        <p>Îți deschid contul…</p>
      )}
    </div>
  );
}
