import type { ReactNode } from "react";

import ChartShell from "@/components/site/ChartShell";

/**
 * Every coin's page: the chart and its heading, which stay mounted as the
 * reader moves from coin to coin, then the page's own text.
 */
export default function ChartsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex flex-1 flex-col">
        <ChartShell />
        {children}
      </main>
      <footer className="mx-auto w-full max-w-5xl shrink-0 px-3 pb-4 text-xs text-muted-foreground sm:px-4">
        Charts and prices for information only, not advice or an offer to buy or
        sell anything. Prices come from the exchange shown on the chart.
      </footer>
    </div>
  );
}
