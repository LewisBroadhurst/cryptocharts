import type { Interval } from "@/lib/charts/bars";
import type { Study } from "@/lib/charts/studies";
import { GOLDEN_CROSS_STRATEGY } from "@/lib/backtest/strategies";
import { DEFAULT_PAIR, pairById, pairBySlug, type Pair } from "@/lib/market/pairs";
import { EMA_COLOR } from "@/lib/site/ema-color";

/**
 * The pages beyond each coin's own: one per indicator reading and one per
 * backtested strategy, each opening the chart already set up for it. The
 * first batch covers three coins; see docs/seo-pages.md for the rest.
 */
export const TOPIC_PAIRS: readonly string[] = ["BTC-USD", "ETH-USD", "SOL-USD"];

/** What the chart opens with on a page about one reading. Nothing the reader
    changes there is saved: their own layout and script stay as they were. */
export type ChartPreset = {
  key: string;
  interval: Interval;
  studies: Study[];
  /** The backtester's script on this page. */
  script?: string;
};

/** Fired by a page's "Open in backtester": the chart opens its backtester on
    the page's script. */
export const OPEN_BACKTEST_EVENT = "cryptocharts:open-backtest";

const SMA_50: Study = { id: "sma-50", kind: "sma", length: 50, color: "#38bdf8", width: 2 };
const SMA_200: Study = { id: "sma-200", kind: "sma", length: 200, color: EMA_COLOR, width: 2 };
const RSI_14: Study = { id: "rsi-14", kind: "rsi", length: 14, color: "#a78bfa", width: 2 };

export type IndicatorId = "rsi" | "200-day-moving-average" | "golden-cross";
export type StrategyId = "golden-cross";

export const INDICATORS: Record<
  IndicatorId,
  { name: string; heading: (label: string) => string; studies: Study[] }
> = {
  rsi: {
    name: "RSI",
    heading: (label) => `${label} RSI chart`,
    studies: [RSI_14],
  },
  "200-day-moving-average": {
    name: "200-day moving average",
    heading: (label) => `${label} 200-day moving average`,
    studies: [SMA_200],
  },
  "golden-cross": {
    name: "golden cross",
    heading: (label) => `${label} golden cross and death cross`,
    studies: [SMA_50, SMA_200],
  },
};

export const STRATEGIES: Record<
  StrategyId,
  { name: string; heading: (label: string) => string; studies: Study[]; script: string }
> = {
  "golden-cross": {
    name: "golden cross backtest",
    heading: (label) => `${label} golden cross backtest`,
    studies: [SMA_50, SMA_200],
    script: GOLDEN_CROSS_STRATEGY,
  },
};

export const INDICATOR_IDS = Object.keys(INDICATORS) as IndicatorId[];
export const STRATEGY_IDS = Object.keys(STRATEGIES) as StrategyId[];

/** The indicators with a page listing every coin's reading. */
export type HubId = Extract<IndicatorId, "rsi" | "golden-cross">;
export const HUB_IDS: readonly HubId[] = ["rsi", "golden-cross"];

export type ChartPage =
  | { kind: "coin"; pair: Pair }
  | { kind: "indicator"; pair: Pair; indicator: IndicatorId }
  | { kind: "backtest"; pair: Pair; strategy: StrategyId };

const isIndicator = (value: string): value is IndicatorId => value in INDICATORS;
const isStrategy = (value: string): value is StrategyId => value in STRATEGIES;
export const hasTopics = (pair: Pair) => TOPIC_PAIRS.includes(pair.id);

/** A pair's page: Bitcoin, the chart the site opens on, is the home page;
    every other coin has its own, `/ethereum`. */
export const pairPath = (pair: Pair): string =>
  pair.id === DEFAULT_PAIR ? "/" : `/${pair.slug}`;

export function chartPagePath(page: ChartPage): string {
  if (page.kind === "coin") return pairPath(page.pair);
  if (page.kind === "indicator") return `/${page.pair.slug}/${page.indicator}`;
  return `/${page.pair.slug}/backtest/${page.strategy}`;
}

export const hubPath = (indicator: IndicatorId): string => `/indicators/${indicator}`;

/** The chart page at `pathname`, or undefined for any other page. */
export function chartPageForPath(pathname: string): ChartPage | undefined {
  if (pathname === "/") return { kind: "coin", pair: pairById(DEFAULT_PAIR)! };
  const [slug, ...rest] = pathname.slice(1).split("/");
  const pair = pairBySlug(slug);
  if (!pair) return undefined;
  if (rest.length === 0)
    return pair.id === DEFAULT_PAIR ? undefined : { kind: "coin", pair };
  if (!hasTopics(pair)) return undefined;
  if (rest.length === 1 && isIndicator(rest[0]))
    return { kind: "indicator", pair, indicator: rest[0] };
  if (rest.length === 2 && rest[0] === "backtest" && isStrategy(rest[1]))
    return { kind: "backtest", pair, strategy: rest[1] };
  return undefined;
}

/** The same page for another coin, where there is one; otherwise its chart. */
export function samePageFor(page: ChartPage, pair: Pair): ChartPage {
  if (page.kind === "coin" || !hasTopics(pair)) return { kind: "coin", pair };
  return { ...page, pair };
}

/** "Ethereum (ETH)", or just "XRP" where the name is the symbol. */
export const coinLabel = (pair: Pair): string =>
  pair.name === pair.base ? pair.name : `${pair.name} (${pair.base})`;

export function chartPageHeading(page: ChartPage): string {
  const label = coinLabel(page.pair);
  if (page.kind === "indicator") return INDICATORS[page.indicator].heading(label);
  if (page.kind === "backtest") return STRATEGIES[page.strategy].heading(label);
  return `${coinLabel(page.pair)} live price chart`;
}

export function chartPreset(page: ChartPage): ChartPreset | undefined {
  if (page.kind === "indicator")
    return {
      key: page.indicator,
      interval: "1D",
      studies: INDICATORS[page.indicator].studies,
    };
  if (page.kind === "backtest") {
    const strategy = STRATEGIES[page.strategy];
    return {
      key: `backtest/${page.strategy}`,
      interval: "1D",
      studies: strategy.studies,
      script: strategy.script,
    };
  }
  return undefined;
}

/** Every page in this set, for the sitemap and static builds. */
export function topicPages(): ChartPage[] {
  return TOPIC_PAIRS.flatMap((id) => {
    const pair = pairById(id)!;
    return [
      ...INDICATOR_IDS.map((indicator): ChartPage => ({ kind: "indicator", pair, indicator })),
      ...STRATEGY_IDS.map((strategy): ChartPage => ({ kind: "backtest", pair, strategy })),
    ];
  });
}
