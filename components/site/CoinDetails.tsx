import Link from "next/link";

import { cn } from "@big-shared/ui/cn";
import { PAIRS, type Pair } from "@/lib/market/pairs";
import { coinAmount, fetchSnapshot, usd, type Snapshot } from "@/lib/market/snapshot";
import { signedPct } from "@/lib/format";
import { coinLabel, pairPath, pairStructuredData } from "@/lib/site/seo";

const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function Figures({ pair, snapshot }: { pair: Pair; snapshot: Snapshot }) {
  const figures: [string, string][] = [
    ["Price", usd(snapshot.price)],
    ["Today, since 00:00 UTC", signedPct(snapshot.changeToday)],
    ["24h high", usd(snapshot.high24h)],
    ["24h low", usd(snapshot.low24h)],
    ["24h volume", coinAmount(snapshot.volume24h, pair.base)],
  ];
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-5">
        {figures.map(([label, value], i) => (
          <div
            key={label}
            // Five figures in two columns: the last takes the whole row.
            className={cn(
              "flex flex-col gap-0.5 bg-background px-3 py-2",
              i === figures.length - 1 && "col-span-2 sm:col-span-1",
            )}
          >
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium tabular-nums text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        From Kraken at {TIME.format(snapshot.at)} UTC on {DAY.format(snapshot.at)}. The
        chart above is live.
      </p>
    </div>
  );
}

/**
 * What follows a coin's chart, for a reader who scrolls and for search
 * engines: what the coin is, its figures when the page was built and links to
 * the other coins' charts. The chart and its heading come from the layout, so
 * they stay put as the reader moves between coins.
 */
export default async function CoinDetails({ pair }: { pair: Pair }) {
  const snapshot = await fetchSnapshot(pair);
  const label = coinLabel(pair);
  const others = PAIRS.filter((one) => one.id !== pair.id);

  return (
    <section
      aria-labelledby="about-coin"
      className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 pt-3 pb-6 sm:px-4"
    >
      <script
        type="application/ld+json"
        // Built from our own constants, never from a request.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pairStructuredData(pair)) }}
      />
      <div className="flex flex-col gap-1.5">
        <h2 id="about-coin" className="text-base font-semibold text-foreground">
          About {label}
        </h2>
        <p className="max-w-prose text-sm text-subtle-foreground">{pair.about}</p>
      </div>
      {snapshot && <Figures pair={pair} snapshot={snapshot} />}
      <nav aria-labelledby="more-charts" className="flex flex-col gap-2">
        <h2 id="more-charts" className="text-sm font-semibold text-foreground">
          More live charts
        </h2>
        <ul className="flex flex-wrap gap-2">
          {others.map((one) => (
            <li key={one.id}>
              <Link
                href={pairPath(one)}
                className="flex h-8 items-center rounded-md border border-border px-2.5 text-xs text-subtle-foreground transition hover:bg-secondary hover:text-foreground"
              >
                {one.name} chart
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
