import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/reports")({
  component: () => (
    <div className="max-w-md mx-auto px-5 pt-10">
      <h1 className="font-serif text-3xl font-semibold">Reports</h1>
      <p className="mt-3 text-sm text-muted-foreground">Account-level metrics, charts, and AI insights will live here.</p>
      <div className="mt-6 card-floating p-6 text-sm text-muted-foreground">No data yet — launch a campaign to see performance.</div>
    </div>
  ),
});