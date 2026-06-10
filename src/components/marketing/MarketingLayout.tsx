import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageHero({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <section className="px-6 pt-20 pb-12 max-w-4xl mx-auto w-full text-center">
      {eyebrow && <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-4">{eyebrow}</p>}
      <h1 className="font-serif text-5xl md:text-6xl font-semibold leading-[1.05] tracking-tight">{title}</h1>
      {subtitle && <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">{subtitle}</p>}
    </section>
  );
}