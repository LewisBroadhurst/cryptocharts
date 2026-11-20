import type { Candle } from "@/lib/data/chart-data";
import { rsi } from "@/lib/charts/indicators";
import { RSI_LEVELS, smaLine } from "@/lib/charts/studies";

const DAY_S = 86_400;
const [OVERBOUGHT, OVERSOLD] = RSI_LEVELS;

export type RsiZone = "overbought" | "oversold" | "neutral";

export type RsiReading = {
  value: number;
  zone: RsiZone;
  /** The newest daily bar at or above 70, and at or below 30, if any. */
  lastOverbought: number | null;
  lastOversold: number | null;
  /** The highest and lowest readings of the last 90 days. */
  high90: number;
  low90: number;
  at: number;
};

export const rsiZone = (value: number): RsiZone =>
  value >= OVERBOUGHT ? "overbought" : value <= OVERSOLD ? "oversold" : "neutral";

/** RSI 14 on daily bars, as the chart draws it. */
export function rsiReading(bars: readonly Candle[], length = 14): RsiReading | null {
  const line = rsi(bars, length);
  const now = line.at(-1);
  if (!now) return null;
  const lastWhere = (test: (value: number) => boolean) =>
    line.findLast((point) => test(point.value))?.time ?? null;
  const recent = line.slice(-90).map((point) => point.value);
  return {
    value: now.value,
    zone: rsiZone(now.value),
    lastOverbought: lastWhere((value) => value >= OVERBOUGHT),
    lastOversold: lastWhere((value) => value <= OVERSOLD),
    high90: Math.max(...recent),
    low90: Math.min(...recent),
    at: now.time,
  };
}

export type SmaReading = {
  length: number;
  price: number;
  sma: number;
  /** How far the price is from the average, as a % of the average. */
  distancePct: number;
  above: boolean;
  /** The first close of the current run on this side of the average, or null
      if the price has stayed on it for every bar we have. */
  since: number | null;
  /** Whole days in the current run. */
  days: number;
  /** The previous run on the same side, if it was longer: "its longest since". */
  longerRunEnded: number | null;
  at: number;
};

/** Where the close stands against its `length`-day simple moving average. */
export function smaReading(bars: readonly Candle[], length = 200): SmaReading | null {
  const line = smaLine(bars, length);
  const now = line.at(-1);
  if (!now) return null;
  const offset = bars.length - line.length;
  const sides = line.map((point, i) => bars[offset + i].close >= point.value);
  const above = sides.at(-1)!;
  const price = bars.at(-1)!.close;

  // The bars split into runs on one side of the average, oldest first.
  const runs: { above: boolean; start: number; end: number }[] = [];
  sides.forEach((side, i) => {
    const run = runs.at(-1);
    if (run && run.above === side) run.end = i;
    else runs.push({ above: side, start: i, end: i });
  });
  const current = runs.at(-1)!;
  const start = current.start;
  const days = current.end - current.start + 1;
  const longer = runs.findLast(
    (run) => run !== current && run.above === above && run.end - run.start + 1 > days,
  );
  const longerRunEnded = longer ? line[longer.end].time : null;

  return {
    length,
    price,
    sma: now.value,
    distancePct: (price / now.value - 1) * 100,
    above,
    since: start > 0 ? line[start].time : null,
    days,
    longerRunEnded,
    at: now.time,
  };
}

export type Cross = { time: number; kind: "golden" | "death" };

export type CrossReading = {
  state: "golden" | "death";
  fast: number;
  slow: number;
  /** The 50-day SMA's distance from the 200-day, as a % of the 200-day. */
  gapPct: number;
  /** Every cross in the bars we have, newest first. */
  crosses: Cross[];
  at: number;
};

/** The 50-day SMA against the 200-day: a golden cross is the 50 crossing
    above, a death cross crossing below. */
export function crossReading(bars: readonly Candle[]): CrossReading | null {
  const fast = smaLine(bars, 50);
  const slow = smaLine(bars, 200);
  if (slow.length === 0) return null;
  const fastFrom = fast.length - slow.length;
  const crosses: Cross[] = [];
  for (let i = 1; i < slow.length; i++) {
    const before = fast[fastFrom + i - 1].value > slow[i - 1].value;
    const now = fast[fastFrom + i].value > slow[i].value;
    if (before !== now) crosses.push({ time: slow[i].time, kind: now ? "golden" : "death" });
  }
  const f = fast.at(-1)!.value;
  const s = slow.at(-1)!.value;
  return {
    state: f > s ? "golden" : "death",
    fast: f,
    slow: s,
    gapPct: (f / s - 1) * 100,
    crosses: crosses.reverse(),
    at: slow.at(-1)!.time,
  };
}

/** Whole days from one bar's time to another's. */
export const daysBetween = (from: number, to: number): number =>
  Math.round((to - from) / DAY_S);
