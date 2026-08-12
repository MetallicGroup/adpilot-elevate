import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body = [
          "User-agent: *",
          "Allow: /",
          "Disallow: /dashboard",
          "Disallow: /settings",
          "Disallow: /onboarding",
          "Disallow: /checkout",
          "Disallow: /auth",
          "",
          "Sitemap: https://adpilot.ro/sitemap.xml",
          "",
        ].join("\n");
        return new Response(body, {
          headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
