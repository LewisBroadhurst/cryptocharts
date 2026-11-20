import type { ReactNode } from "react";

import HomeLink from "@/components/site/HomeLink";
import SiteFooter from "@/components/site/SiteFooter";

/** The pages listing one indicator for every coin. */
export default function IndicatorsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex shrink-0 items-center px-3 pt-2 sm:px-4 sm:pt-3">
        <HomeLink />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter />
    </div>
  );
}
