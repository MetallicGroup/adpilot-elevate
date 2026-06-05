import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

function Settings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="max-w-md mx-auto px-5 pt-10 space-y-6">
      <h1 className="font-serif text-3xl font-semibold">Settings</h1>
      <div className="card-floating p-5">
        <p className="text-xs text-muted-foreground">Plan</p>
        <p className="mt-1 font-semibold">Starter · $49/mo</p>
        <p className="mt-2 text-xs text-muted-foreground">Stripe billing portal coming soon.</p>
      </div>
      <div className="card-floating p-5">
        <p className="text-xs text-muted-foreground">TikTok ad accounts</p>
        <p className="mt-1 text-sm">No accounts connected yet.</p>
      </div>
      <button onClick={signOut} className="press w-full py-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary">
        Sign out
      </button>
    </div>
  );
}