import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@big-shared/ui/cn";
import { pairById, type Pair } from "@/lib/market/pairs";
import {
  chartPagePath,
  hasTopics,
  hubPath,
  HUB_IDS,
  INDICATOR_IDS,
  INDICATORS,
  STRATEGIES,
  STRATEGY_IDS,
  TOPIC_PAIRS,
  type ChartPage,
  type IndicatorId,
} from "@/lib/site/pages";
import { HUBS } from "@/lib/site/seo";

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

export const SECTION =
  "mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 pt-3 pb-6 sm:px-4";
const CHIP =
  "flex h-8 items-center rounded-md border border-border px-2.5 text-xs text-subtle-foreground transition hover:bg-secondary hover:text-foreground";

/** A row of labelled figures, as under each coin's chart. */
export function Figures({
  figures,
}: {
  figures: readonly (readonly [label: string, value: ReactNode])[];
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border",
        figures.length >= 5 ? "sm:grid-cols-5" : figures.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3",
      )}
    >
      {figures.map(([label, value], i) => (
        <div
          key={label}
          className={cn(
            "flex flex-col gap-0.5 bg-background px-3 py-2",
            figures.length % 2 === 1 && i === figures.length - 1 && "col-span-2 sm:col-span-1",
          )}
        >
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-sm font-medium tabular-nums text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Stamp({ at, chart = true }: { at: number; chart?: boolean }) {
  return (
    <p className="text-xs text-muted-foreground">
      From Kraken&apos;s daily bars at {TIME.format(at)} UTC on {DAY.format(at)}, today&apos;s
      still open.{chart && " The chart above is live."}
    </p>
  );
}

export function Unavailable() {
  return (
    <p className="text-sm text-subtle-foreground">
      Kraken&apos;s daily bars couldn&apos;t be reached when this page was built. The
      chart above is live.
    </p>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <p className="max-w-prose text-sm text-subtle-foreground">{children}</p>;
}

export function LinkRow({
  id,
  title,
  links,
}: {
  id: string;
  title: string;
  links: { href: string; label: string }[];
}) {
  if (links.length === 0) return null;
  return (
    <nav aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-sm font-semibold text-foreground">
        {title}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={CHIP}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export const pageLabel = (page: ChartPage): string =>
  page.kind === "indicator"
    ? `${page.pair.name} ${INDICATORS[page.indicator].name}`
    : page.kind === "backtest"
      ? `${page.pair.name} ${STRATEGIES[page.strategy].name}`
      : `${page.pair.name} chart`;

/** This coin's other indicator and backtest pages; this page for the other
    coins; the pages listing every coin's reading. */
export function TopicLinks({ page }: { page: ChartPage }) {
  const { pair } = page;
  const here = chartPagePath(page);
  const forCoin: ChartPage[] = [
    { kind: "coin", pair },
    ...INDICATOR_IDS.map((indicator): ChartPage => ({ kind: "indicator", pair, indicator })),
    ...STRATEGY_IDS.map((strategy): ChartPage => ({ kind: "backtest", pair, strategy })),
  ];
  const others = TOPIC_PAIRS.map((id) => pairById(id)!)
    .filter((one) => one.id !== pair.id)
    .map((one): ChartPage => ({ ...page, pair: one }));
  const toLink = (one: ChartPage) => ({ href: chartPagePath(one), label: pageLabel(one) });

  return (
    <>
      <LinkRow
        id="more-for-coin"
        title={`More ${pair.name} charts`}
        links={forCoin.filter((one) => chartPagePath(one) !== here).map(toLink)}
      />
      <LinkRow id="other-coins" title="Other coins" links={others.map(toLink)} />
      <LinkRow
        id="every-coin"
        title="Every coin"
        links={HUB_IDS.map((id) => ({ href: hubPath(id), label: HUBS[id].heading }))}
      />
    </>
  );
}

/** Where a coin's name in a list goes: its page for this reading, or its chart. */
export const coinHref = (pair: Pair, indicator: IndicatorId): string =>
  chartPagePath(hasTopics(pair) ? { kind: "indicator", pair, indicator } : { kind: "coin", pair });


/** On a coin's own page: its indicator and backtest pages, if it has them. */
export function CoinTopicLinks({ pair }: { pair: Pair }) {
  if (!hasTopics(pair)) return null;
  const pages: ChartPage[] = [
    ...INDICATOR_IDS.map((indicator): ChartPage => ({ kind: "indicator", pair, indicator })),
    ...STRATEGY_IDS.map((strategy): ChartPage => ({ kind: "backtest", pair, strategy })),
  ];
  return (
    <LinkRow
      id="coin-topics"
      title={`${pair.name} indicators and backtests`}
      links={pages.map((page) => ({ href: chartPagePath(page), label: pageLabel(page) }))}
    />
  );
}
