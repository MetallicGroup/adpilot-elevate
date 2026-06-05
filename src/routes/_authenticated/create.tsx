import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/create")({
  component: () => (
    <div className="max-w-md mx-auto px-5 pt-10">
      <h1 className="font-serif text-3xl font-semibold">Create campaign</h1>
      <p className="mt-3 text-sm text-muted-foreground">Step-by-step wizard coming next — goal, budget, audience, creative, lead form, review.</p>
      <div className="mt-6 card-floating p-6 text-sm text-muted-foreground">
        Connect your TikTok account first to enable campaign launch.
      </div>
    </div>
  ),
});