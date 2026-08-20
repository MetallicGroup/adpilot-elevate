import { createFileRoute } from "@tanstack/react-router";
import { NicheLanding } from "@/components/marketing/NicheLanding";
import { NICHES } from "@/lib/niches";

const niche = NICHES.cursuri;

export const Route = createFileRoute("/cursuri")({
  head: () => ({
    meta: [
      { title: niche.meta.title },
      { name: "description", content: niche.meta.description },
      { property: "og:title", content: niche.meta.title },
      { property: "og:description", content: niche.meta.description },
      { property: "og:url", content: "https://adpilot.ro/cursuri" },
    ],
    links: [{ rel: "canonical", href: "https://adpilot.ro/cursuri" }],
  }),
  component: () => <NicheLanding niche={niche} />,
});
