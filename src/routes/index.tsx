import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostAuthPath } from "@/lib/post-auth";
import { HomeV3 } from "@/components/v3/HomeV3";
import { v3Head } from "@/components/v3/ui";
import { getFlowState } from "@/lib/v3.functions";
import { tkViewContent } from "@/lib/tiktok-pixel";

export const Route = createFileRoute("/")({
  head: () => {
    const h = v3Head(
      "AdPilot — Clienți noi, direct pe WhatsApp",
      "Spui ce vrei să promovezi. AdPilot face reclama pe Facebook, Instagram sau TikTok și o pornește azi. Fiecare om interesat îți apare pe WhatsApp, cu nume și telefon. 495 lei pe lună.",
      [
        { property: "og:title", content: "AdPilot — Clienți noi, direct pe WhatsApp" },
        {
          property: "og:description",
          content:
            "Reclame pe Facebook, Instagram și TikTok pornite azi. Cererile îți vin pe WhatsApp în câteva minute.",
        },
        { property: "og:url", content: "https://adpilot.ro/" },
      ],
    );
    return { ...h, links: [...h.links, { rel: "canonical", href: "https://adpilot.ro/" }] };
  },
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
      // Agențiile rămân în panoul lor; afacerile merg în fluxul nou (panou dacă au deja campanii sau pachet).
      const dest = await resolvePostAuthPath();
      if (cancelled) return;
      if (dest === "/agency/dashboard") return navigate({ to: dest, replace: true });
      try {
        const f = await getFlowState();
        if (cancelled) return;
        const to =
          f.liveCount > 0 || f.hasAdsPlan
            ? "/panou"
            : f.metaConnected || f.tiktokConnected
              ? "/campanie"
              : "/conectare";
        window.location.replace(to);
      } catch {
        navigate({ to: dest, replace: true });
      }
    }

    redirectSignedInUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN") return;
      void redirectSignedInUser();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate]);

  return <HomeV3 />;
}
