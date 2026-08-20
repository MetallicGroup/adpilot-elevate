import { createFileRoute } from "@tanstack/react-router";
import { NicheLanding } from "@/components/marketing/NicheLanding";
import { NICHES } from "@/lib/niches";

const niche = NICHES.imobiliare;

export const Route = createFileRoute("/imobiliare")({
  head: () => ({
    meta: [
      { title: niche.meta.title },
      { name: "description", content: niche.meta.description },
      { property: "og:title", content: niche.meta.title },
      { property: "og:description", content: niche.meta.description },
      { property: "og:url", content: "https://adpilot.ro/imobiliare" },
    ],
    links: [{ rel: "canonical", href: "https://adpilot.ro/imobiliare" }],
  }),
  component: () => <NicheLanding niche={niche} />,
});
