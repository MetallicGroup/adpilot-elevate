import type { ReactNode } from "react";
import { MarketingLayout } from "./MarketingLayout";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <MarketingLayout>
      <article className="px-6 pt-16 pb-24 max-w-3xl mx-auto w-full">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Legal</p>
        <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {updated}</p>
        <div className="prose-styles mt-10 space-y-6 text-[15px] leading-relaxed text-foreground/90">
          {children}
        </div>
      </article>
    </MarketingLayout>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="font-serif text-2xl font-semibold mt-10 mb-2 text-foreground">{children}</h2>;
}
export function P({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground leading-relaxed">{children}</p>;
}
export function UL({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">{children}</ul>;
}