import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id: sessionId } = Route.useSearch();
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="max-w-md w-full card-floating p-10 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-success/15 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h1 className="mt-6 font-serif text-3xl font-semibold">Bun venit la AdPilot!</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {sessionId
            ? "Perioada ta de 7 zile gratuite a început. Nu îți vom retrage nimic de pe card înainte de finalul perioadei de probă."
            : "Mulțumim! Contul tău este pregătit."}
        </p>
        <Link
          to="/dashboard"
          className="press mt-8 inline-flex items-center justify-center w-full px-6 py-3 rounded-xl bg-foreground text-background font-medium"
        >
          Mergi la dashboard
        </Link>
      </div>
    </main>
  );
}