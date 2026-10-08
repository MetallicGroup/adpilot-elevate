import type { ReactNode } from "react";
import { Hero, V2Shell } from "@/components/v2/kit";

/** Shell for public pages. Now a thin wrapper over the v2 kit. */
export function MarketingLayout({ children }: { children: ReactNode }) {
  return <V2Shell>{children}</V2Shell>;
}

export function PageHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return <Hero eyebrow={eyebrow} title={title} sub={subtitle} />;
}
