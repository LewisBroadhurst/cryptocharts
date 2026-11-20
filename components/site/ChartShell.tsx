"use client";

import { usePathname } from "next/navigation";

import AccountBadge from "@/components/account/AccountBadge";
import LazyChartWorkspace from "@/components/charts/LazyChartWorkspace";
import HomeLink from "@/components/site/HomeLink";
import { track } from "@/lib/analytics/analytics";
import { coinLabel, pairForPath } from "@/lib/site/seo";

/**
 * The heading and live chart for the coin whose page this is. It sits in the
 * layout, so moving to another coin's page changes the chart in place: full
 * screen, an open backtest and the chart's settings all carry over.
 */
export default function ChartShell() {
  const pair = pairForPath(usePathname());
  // A page that isn't a coin's, such as a 404, shows no chart.
  if (!pair) return null;

  return (
    <>
      <header className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 pt-2 sm:px-4 sm:pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <HomeLink />
          <span aria-hidden className="text-muted-foreground">
            /
          </span>
          <h1 className="truncate text-base font-normal text-foreground">
            {coinLabel(pair)} live price chart
          </h1>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <AccountBadge />
          <a
            href="https://www.stratdeck.uk"
            onClick={() => track("stratdeck_clicked")}
            className="text-sm text-subtle-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Charting stocks? Try StratDeck
          </a>
        </div>
      </header>
      {/* A strip of the page's text shows under the chart, so a reader sees
          there is more and has somewhere to scroll from: the chart takes every
          drag. */}
      <div className="flex h-[calc(100dvh-5.5rem)] min-h-[28rem] flex-col p-2 sm:p-3">
        <LazyChartWorkspace pair={pair.id} />
      </div>
    </>
  );
}
