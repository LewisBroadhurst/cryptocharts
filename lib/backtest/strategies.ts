import type { BacktestTrade } from "@/lib/backtest/engine";
import type { Candle } from "@/lib/data/chart-data";

/** What the backtester starts with, and what its costs default to. */
export const START_CASH = 10_000;
export const DEFAULT_COSTS = { fee: 0.1, slippage: 0.05 } as const;

/** The golden-cross strategy as the backtester runs it. */
export const GOLDEN_CROSS_STRATEGY = `# Golden cross: long while the 50-day SMA is above the 200-day SMA,
# flat after the death cross. Run it on the 1D chart.

def on_bar(bar, ctx):
    fast, slow = ctx.sma(50), ctx.sma(200)
    if fast is None or slow is None:
        return
    if fast > slow and ctx.position <= 0:
        ctx.buy()
    elif fast < slow and ctx.position > 0:
        ctx.close()
`;

/** 1 long, 0 flat, or nothing to do. */
type Order = 1 | 0 | null;

export type StrategyResult = {
  trades: BacktestTrade[];
  openTrade: { entryTime: number; entryPrice: number; returnPct: number } | null;
  equity: { time: number; value: number }[];
  returnPct: number;
  /** Holding the coin from the open of `holdFrom`, the first bar the
      strategy could trade on, to the last close. */
  buyHoldPct: number;
  holdFrom: number;
  winRatePct: number | null;
  maxDrawdownPct: number;
  fees: number;
};

/**
 * A long-only copy of the Python engine's loop (lib/backtest/engine.ts), so a
 * page can show a strategy's results without Python: each order fills at the
 * next bar's open, less slippage, and pays the fee on what it trades. A test
 * holds the two to the same answers.
 *
 * Buy and hold starts at bar `warmUp`, the first the strategy could fill an
 * order on, so the comparison covers the same days. The Python engine starts
 * it at the first bar, as it can't know a script's warm-up.
 */
export function simulate(
  bars: readonly Candle[],
  decide: (i: number, position: 0 | 1) => Order,
  feePct: number = DEFAULT_COSTS.fee,
  slippagePct: number = DEFAULT_COSTS.slippage,
  warmUp = 0,
): StrategyResult | null {
  if (bars.length < 2 || warmUp >= bars.length) return null;
  const fee = feePct / 100;
  const slip = slippagePct / 100;
  let cash = START_CASH;
  let units = 0;
  let side: 0 | 1 = 0;
  let entry: { entryTime: number; entryPrice: number } | null = null;
  let order: Order = null;
  let fees = 0;
  const trades: BacktestTrade[] = [];
  const equity: { time: number; value: number }[] = [];

  bars.forEach((bar, i) => {
    if (order !== null && order !== side) {
      if (side === 1 && entry) {
        const price = bar.open * (1 - slip);
        const value = units * price;
        const paid = value * fee;
        cash += value - paid;
        fees += paid;
        trades.push({
          side: "long",
          ...entry,
          exitTime: bar.time,
          exitPrice: price,
          returnPct: (price / entry.entryPrice - 1) * 100,
        });
        units = 0;
        side = 0;
        entry = null;
      }
      if (order === 1) {
        const price = bar.open * (1 + slip);
        const paid = cash * fee;
        fees += paid;
        units = (cash - paid) / price;
        cash = 0;
        side = 1;
        entry = { entryTime: bar.time, entryPrice: price };
      }
    }
    order = decide(i, side);
    equity.push({ time: bar.time, value: cash + units * bar.close });
  });

  const last = bars[bars.length - 1].close;
  let peak = equity[0].value;
  let worst = 0;
  for (const point of equity) {
    peak = Math.max(peak, point.value);
    worst = Math.min(worst, point.value / peak - 1);
  }
  const end = equity[equity.length - 1].value;
  const wins = trades.filter((trade) => trade.returnPct > 0).length;
  const open = entry as { entryTime: number; entryPrice: number } | null;
  return {
    trades,
    openTrade: open && { ...open, returnPct: (last / open.entryPrice - 1) * 100 },
    equity,
    returnPct: (end / START_CASH - 1) * 100,
    buyHoldPct: (last / bars[warmUp].open - 1) * 100,
    holdFrom: bars[warmUp].time,
    winRatePct: trades.length > 0 ? (wins / trades.length) * 100 : null,
    maxDrawdownPct: worst * 100,
    fees,
  };
}

/** The mean of the `length` closes up to bar `i`, summed as Python's `sum`
    does, oldest first, so the two engines compare the same numbers. */
function smaAt(closes: readonly number[], i: number, length: number): number | null {
  if (i + 1 < length) return null;
  let sum = 0;
  for (let j = i + 1 - length; j <= i; j++) sum += closes[j];
  return sum / length;
}

/** The golden cross decides first on bar 199, with 200 closes, and fills on
    bar 200. */
export const GOLDEN_CROSS_WARM_UP = 200;

/** GOLDEN_CROSS_STRATEGY, in TypeScript. */
export function goldenCrossBacktest(
  bars: readonly Candle[],
  feePct?: number,
  slippagePct?: number,
): StrategyResult | null {
  const closes = bars.map((bar) => bar.close);
  return simulate(
    bars,
    (i, position) => {
      const fast = smaAt(closes, i, 50);
      const slow = smaAt(closes, i, 200);
      if (fast === null || slow === null) return null;
      if (fast > slow && position <= 0) return 1;
      if (fast < slow && position > 0) return 0;
      return null;
    },
    feePct,
    slippagePct,
    GOLDEN_CROSS_WARM_UP,
  );
}
