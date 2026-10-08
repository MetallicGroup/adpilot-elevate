import type { ReactNode } from "react";
import { Band, Hero } from "@/components/v2/kit";
import { MarketingLayout } from "./MarketingLayout";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <MarketingLayout>
      <Hero eyebrow="Legal" title={title} sub={`Ultima actualizare: ${updated}`} />
      <Band tone="dark">
        <article className="legal">{children}</article>
      </Band>
    </MarketingLayout>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2>{children}</h2>;
}
export function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}
export function UL({ children }: { children: ReactNode }) {
  return <ul>{children}</ul>;
}
