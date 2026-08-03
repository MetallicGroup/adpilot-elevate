import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const STORAGE_KEY = "adpilot_cookie_consent_v1";

export type CookieConsentValue = "all" | "essential";

export function openCookiePreferences() {
  window.dispatchEvent(new CustomEvent("adpilot:open-cookie-preferences"));
}

export function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
    const handler = () => setOpen(true);
    window.addEventListener("adpilot:open-cookie-preferences", handler);
    return () => window.removeEventListener("adpilot:open-cookie-preferences", handler);
  }, []);

  const decide = (value: CookieConsentValue) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ value, at: new Date().toISOString() }));
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-5">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">Confidențialitate și cookies</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Folosim cookies strict necesare pentru funcționarea platformei și, cu acordul tău, cookies de
              analiză și marketing. Prin „Accept toate” îți dai consimțământul conform GDPR
              (Regulamentul UE 2016/679). Detalii în{" "}
              <Link to="/cookie-policy" className="text-primary underline underline-offset-4">Politica de cookies</Link>,{" "}
              <Link to="/privacy-policy" className="text-primary underline underline-offset-4">Politica de confidențialitate</Link>{" "}
              și{" "}
              <Link to="/gdpr" className="text-primary underline underline-offset-4">Conformitate GDPR</Link>.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <Button onClick={() => decide("all")} className="sm:min-w-40">Accept toate</Button>
              <Button variant="outline" onClick={() => decide("essential")}>Doar strict necesare</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
