import type { ReactNode } from "react";

import ChartShell from "@/components/site/ChartShell";
import SiteFooter from "@/components/site/SiteFooter";

/**
 * Every chart page, a coin's or one of its indicator and backtest pages: the
 * chart and its heading, which stay mounted as the reader moves between them,
 * then the page's own text.
 */
export default function ChartsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex flex-1 flex-col">
        <ChartShell />
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
