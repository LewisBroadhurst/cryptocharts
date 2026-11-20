import LazyChartWorkspace from "@/components/charts/LazyChartWorkspace";
import { pairFor } from "@/lib/market/pairs";
import { usableExchange } from "@/lib/market/sources";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const asked = await searchParams;
  const pair = pairFor(asked.pair);
  const exchange = usableExchange(asked.ex);

  return (
    <div className="flex h-dvh flex-col gap-2 p-2 sm:p-3">
      <header className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1">
        <h1 className="text-base font-semibold text-foreground">
          Crypto Charts
          <span className="ml-2 font-normal text-muted-foreground max-sm:hidden">
            Free live charts for the main coins
          </span>
        </h1>
        <a
          href="https://www.stratdeck.uk"
          className="text-sm text-subtle-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Researching stocks? Try StratDeck
        </a>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <LazyChartWorkspace initialPair={pair.id} initialExchange={exchange} />
      </main>
      <footer className="shrink-0 px-1 text-xs text-muted-foreground">
        Charts and prices for information only, not advice or an offer to buy or
        sell anything. Prices come from the exchange shown on the chart.
      </footer>
    </div>
  );
}
