import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

const KEY = "adpilot.cookie.consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(KEY)) setVisible(true);
  }, []);

  function decide(value: "accept" | "reject") {
    localStorage.setItem(KEY, JSON.stringify({ value, ts: Date.now() }));
    setVisible(false);
  }

  if (!visible) return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-50">
      <div className="card-floating-lg p-5 border border-border">
        <p className="text-sm font-semibold">We use cookies</p>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          We use strictly necessary cookies to operate the site, and optional analytics cookies to improve it. See our{" "}
          <Link to="/cookie-policy" className="underline">Cookie Policy</Link>.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => decide("reject")}
            className="press flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
          >
            Reject all
          </button>
          <button
            onClick={() => decide("accept")}
            className="press flex-1 px-4 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}