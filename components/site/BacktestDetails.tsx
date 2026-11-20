import OpenBacktestButton from "@/components/site/OpenBacktestButton";
import {
  Figures,
  Prose,
  SECTION,
  Stamp,
  TopicLinks,
  Unavailable,
} from "@/components/site/topic-parts";
import {
  DEFAULT_COSTS,
  goldenCrossBacktest,
  START_CASH,
  type StrategyResult,
} from "@/lib/backtest/strategies";
import type { Candle } from "@/lib/data/chart-data";
import { chartDay, chartDayMonth } from "@/lib/dates";
import { signedPct } from "@/lib/format";
import { fetchDailyBars } from "@/lib/market/daily";
import type { Pair } from "@/lib/market/pairs";
import { usd } from "@/lib/market/snapshot";
import { STRATEGIES, type StrategyId } from "@/lib/site/pages";
import { topicStructuredData } from "@/lib/site/seo";

const money = (value: number) =>
  `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const W = 640;
const H = 180;

/** The strategy's equity against holding the coin, both from the first day
    the strategy could trade: before that it can only sit in cash. */
function EquityCurve({ bars: all, result }: { bars: Candle[]; result: StrategyResult }) {
  const from = all.findIndex((bar) => bar.time === result.holdFrom);
  const bars = all.slice(from);
  const hold = bars.map((bar) => (START_CASH * bar.close) / bars[0].open);
  const mine = result.equity.slice(from).map((point) => point.value);
  const top = Math.max(...hold, ...mine);
  const bottom = Math.min(...hold, ...mine);
  const y = (value: number) => H - ((value - bottom) / (top - bottom || 1)) * (H - 8) - 4;
  const x = (i: number) => (i / (bars.length - 1)) * W;
  const path = (values: number[]) =>
    values.map((value, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(value).toFixed(1)}`).join("");

  return (
    <figure className="flex flex-col gap-1.5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-44 w-full max-w-2xl"
        preserveAspectRatio="none"
        role="img"
        aria-label="Equity curve against buy and hold"
      >
        <line x1={0} x2={W} y1={y(START_CASH)} y2={y(START_CASH)} stroke="#262626" strokeWidth={1} />
        <path d={path(hold)} fill="none" stroke="#737373" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <path d={path(mine)} fill="none" stroke="#34d399" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-3 bg-[#34d399]" /> Golden cross
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-3 bg-[#737373]" /> Buy and hold
        </span>
      </figcaption>
    </figure>
  );
}

function Results({ pair, bars, now }: { pair: Pair; bars: Candle[]; now: number }) {
  const result = goldenCrossBacktest(bars);
  if (!result) return <Unavailable />;
  const end = START_CASH * (1 + result.returnPct / 100);
  const position = result.openTrade
    ? `Long since ${chartDay(result.openTrade.entryTime)}`
    : "Flat";

  return (
    <>
      <Figures
        figures={[
          ["Return", signedPct(result.returnPct)],
          [`Buy and hold from ${chartDayMonth(result.holdFrom)}`, signedPct(result.buyHoldPct)],
          ["Max drawdown", signedPct(result.maxDrawdownPct)],
          ["Win rate", result.winRatePct === null ? "—" : `${result.winRatePct.toFixed(0)}%`],
          ["Position now", position],
        ]}
      />
      <Prose>
        The strategy needs 200 days of data before it can trade, so both are measured from{" "}
        {chartDay(result.holdFrom)}. Since then, holding {pair.name} while its 50-day SMA was
        above its 200-day SMA turned {money(START_CASH)} into {money(end)} (
        {signedPct(result.returnPct)}), against {signedPct(result.buyHoldPct)} for buy and
        hold. It made {result.trades.length} closed{" "}
        {result.trades.length === 1 ? "trade" : "trades"}
        {result.openTrade ? " and has one open" : ""}, with a max drawdown of{" "}
        {signedPct(result.maxDrawdownPct)}.
      </Prose>
      <EquityCurve bars={bars} result={result} />
      <Stamp at={now} />
      <Prose>
        Orders fill at the next day&apos;s open, with a{" "}
        {DEFAULT_COSTS.fee}% fee and {DEFAULT_COSTS.slippage}% slippage each way. The backtester
        measures buy and hold from the first bar it&apos;s given.
      </Prose>
      {(result.trades.length > 0 || result.openTrade) && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">Trades</h2>
          <div className="overflow-x-auto">
            <table className="w-full max-w-2xl whitespace-nowrap text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-normal">Entry</th>
                  <th className="py-1 pr-3 text-right font-normal">Entry price</th>
                  <th className="py-1 pr-3 font-normal">Exit</th>
                  <th className="py-1 pr-3 text-right font-normal">Exit price</th>
                  <th className="py-1 text-right font-normal">Return</th>
                </tr>
              </thead>
              <tbody>
                {result.openTrade && (
                  <tr className="border-t border-border">
                    <td className="py-1.5 pr-3">{chartDay(result.openTrade.entryTime)}</td>
                    <td className="py-1.5 pr-3 text-right">{usd(result.openTrade.entryPrice)}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">Open</td>
                    <td className="py-1.5 pr-3 text-right">—</td>
                    <td className="py-1.5 text-right">{signedPct(result.openTrade.returnPct)}</td>
                  </tr>
                )}
                {result.trades
                  .slice(-10)
                  .reverse()
                  .map((trade) => (
                    <tr key={trade.entryTime} className="border-t border-border">
                      <td className="py-1.5 pr-3">{chartDay(trade.entryTime)}</td>
                      <td className="py-1.5 pr-3 text-right">{usd(trade.entryPrice)}</td>
                      <td className="py-1.5 pr-3">{chartDay(trade.exitTime)}</td>
                      <td className="py-1.5 pr-3 text-right">{usd(trade.exitPrice)}</td>
                      <td className="py-1.5 text-right">{signedPct(trade.returnPct)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * What follows the chart on a strategy's page: its backtest on the coin's
 * daily bars against buy and hold, the trades, and its Python, which the
 * chart's backtester opens on. The heading and chart come from the layout.
 */
export default async function BacktestDetails({
  pair,
  strategy,
}: {
  pair: Pair;
  strategy: StrategyId;
}) {
  const daily = await fetchDailyBars(pair);
  const page = { kind: "backtest", pair, strategy } as const;

  return (
    <section aria-label="Backtest results" className={SECTION}>
      <script
        type="application/ld+json"
        // Built from our own constants, never from a request.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(topicStructuredData(page)) }}
      />
      {daily ? <Results pair={pair} bars={daily.bars} now={daily.at} /> : <Unavailable />}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foreground">Python strategy</h2>
        <pre className="max-w-2xl overflow-x-auto rounded-lg border border-border bg-surface p-3 text-xs text-subtle-foreground">
          <code>{STRATEGIES[strategy].script}</code>
        </pre>
        <OpenBacktestButton />
      </div>
      <TopicLinks page={page} />
    </section>
  );
}
