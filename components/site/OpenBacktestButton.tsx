"use client";

import { OPEN_BACKTEST_EVENT } from "@/lib/site/pages";

/** Opens the chart's backtester on this page's strategy. */
export default function OpenBacktestButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_BACKTEST_EVENT))}
      className="flex h-8 w-fit items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted"
    >
      Open in backtester
    </button>
  );
}
