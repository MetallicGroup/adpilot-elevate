import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostAuthPath } from "@/lib/post-auth";
import { HomeV2 } from "@/components/v2/HomeV2";
import { tkViewContent } from "@/lib/tiktok-pixel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AdPilot — Tu conduci afacerea. AdPilot conduce reclamele." },
      { name: "description", content: "Tu conduci afacerea. AdPilot conduce reclamele: creează, lansează și optimizează campanii Facebook și Instagram, iar lead-urile vin pe WhatsApp. 7 zile gratuite, fără card." },
      { property: "og:title", content: "AdPilot — Tu conduci afacerea. AdPilot conduce reclamele." },
      { property: "og:description", content: "Spune-i ce vrei să obții. AdPilot creează, lansează și optimizează reclamele tale Facebook și Instagram. 7 zile gratuite, fără card." },
      { property: "og:url", content: "https://adpilot.ro/" },
    ],
    links: [{ rel: "canonical", href: "https://adpilot.ro/" }],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    tkViewContent({ contentId: "home", contentName: "Homepage" });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function redirectSignedInUser() {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "",
      );
      const looksLikeAuthReturn =
        params.has("code") ||
        params.has("error") ||
        params.has("error_description") ||
        hashParams.has("access_token") ||
        hashParams.has("refresh_token") ||
        hashParams.has("type") ||
        hashParams.has("error");

      if (looksLikeAuthReturn) {
        navigate({
          to: "/auth/callback",
          search: Object.fromEntries(params.entries()),
          hash: window.location.hash.startsWith("#") ? window.location.hash.slice(1) : undefined,
          replace: true,
        });
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session || cancelled) return;
      const dest = await resolvePostAuthPath();
      if (!cancelled) navigate({ to: dest, replace: true });
    }

    redirectSignedInUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN") return;
      void redirectSignedInUser();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate]);

  return <HomeV2 />;
}
