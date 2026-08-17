import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import logoAsset from "@/assets/adpilot-logo.png.asset.json";
import ogHeroAsset from "@/assets/og-hero.png.asset.json";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { runOAuthConfigCheck } from "@/lib/oauth-config-check";
import { CookieConsent } from "@/components/CookieConsent";
import { WowBackground } from "@/components/wow/WowBackground";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AdPilot — Reclame Facebook. Lead-uri pe WhatsApp." },
      {
        name: "description",
        content:
          "Lansează și optimizează reclame Facebook dintr-o singură aplicație, iar fiecare lead ajunge direct pe WhatsApp. 3 zile gratuit.",
      },
      { name: "author", content: "AdPilot" },
      { name: "google-site-verification", content: "c5wTyndeBq7gVkBTee-nP_NuFsK769W9Wv0N3GbzHC4" },
      { property: "og:title", content: "AdPilot — Reclame Facebook. Lead-uri pe WhatsApp." },
      {
        property: "og:description",
        content:
          "Lansează și optimizează reclame Facebook dintr-o singură aplicație, iar fiecare lead ajunge direct pe WhatsApp. 3 zile gratuit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "AdPilot — Reclame Facebook. Lead-uri pe WhatsApp." },
      {
        name: "twitter:description",
        content:
          "Lansează și optimizează reclame Facebook dintr-o singură aplicație, iar fiecare lead ajunge direct pe WhatsApp. 3 zile gratuit.",
      },
      { property: "og:image", content: `https://adpilot.ro${ogHeroAsset.url}` },
      { name: "twitter:image", content: `https://adpilot.ro${ogHeroAsset.url}` },
    ],
    scripts: [
      {
        // TikTok Pixel — pentru reclamele AdPilot pe TikTok (marketing propriu,
        // separat de platforma de reclame Meta oferită userilor).
        children:
          `!function (w, d, t) {w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('DA07Q8RC77U9RA6QKUJ0');if(!(/[?#&](access_token|refresh_token|token_hash|provider_token)=/i.test(location.href)||(/^\/auth\//.test(location.pathname)&&/[?#&](code|token)=/i.test(location.href)))){ttq.page();}}(window, document, 'ttq');`,
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://adpilot.ro/#organization",
              name: "AdPilot",
              url: "https://adpilot.ro",
              logo: "https://www.adpilot.ro/adpilot-logo.png",
              email: "support@adpilot.ro",
              sameAs: ["https://www.adpilot.ro"],
            },
            {
              "@type": "WebSite",
              "@id": "https://adpilot.ro/#website",
              name: "AdPilot",
              url: "https://adpilot.ro",
              inLanguage: "ro-RO",
              publisher: { "@id": "https://adpilot.ro/#organization" },
            },
          ],
        }),
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: logoAsset.url },
      { rel: "apple-touch-icon", href: logoAsset.url },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ro" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    runOAuthConfigCheck();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <WowBackground />
      <Outlet />
      <Toaster position="bottom-center" theme="dark" />
      <CookieConsent />
    </QueryClientProvider>
  );
}
