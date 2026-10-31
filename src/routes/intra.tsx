import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const NEXT = new Set(["/start", "/upgrade", "/materiale"]);

/** Pasul din browser al linkului personal: pornește sesiunea și merge mai departe. */
export const Route = createFileRoute("/intra")({
  validateSearch: (s: Record<string, unknown>): { h?: string; next?: string } => ({
    h: typeof s.h === "string" ? s.h : undefined,
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  head: () => ({ meta: [{ title: "Intri în cont — AdPilot" }, { name: "robots", content: "noindex" }] }),
  component: Enter,
});

function Enter() {
  const { h, next } = Route.useSearch();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const to = next && NEXT.has(next) ? next : "/start";
    if (!h) {
      window.location.replace("/start");
      return;
    }
    supabase.auth
      .verifyOtp({ token_hash: h, type: "magiclink" })
      .then(({ error }) => {
        if (error) throw error;
        window.location.replace(to);
      })
      .catch(() => setFailed(true));
  }, [h, next]);
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" }}>
      {failed ? (
        <p>
          Linkul nu mai merge. <a href="/start">Intră cu numărul tău de WhatsApp</a>.
        </p>
      ) : (
        <p>Îți deschid contul…</p>
      )}
    </div>
  );
}
