import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/reports")({
  component: () => (
    <div className="max-w-md mx-auto px-5 pt-10">
      <h1 className="font-serif text-3xl font-semibold">Rapoarte</h1>
      <p className="mt-3 text-sm text-muted-foreground">Aici vor apărea cifrele pe cont, graficele și recomandările AdPilot.</p>
      <div className="mt-6 card-floating p-6 text-sm text-muted-foreground">Încă nu sunt date. Lansează o campanie ca să vezi rezultatele.</div>
    </div>
  ),
});