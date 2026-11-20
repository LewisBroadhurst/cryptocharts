import type { Candle } from "@/lib/data/chart-data";

const DAY = 86_400;
const WEEK = 7 * DAY;
/** 1970-01-01 was a Thursday; Monday 00:00 UTC is four days on. */
const MONDAY = 4 * DAY;

/** The start of the bar a moment falls in. Weeks start Monday 00:00 UTC. */
export function bucketStart(time: number, seconds: number): number {
  if (seconds === WEEK)
    return Math.floor((time - MONDAY) / WEEK) * WEEK + MONDAY;
  return Math.floor(time / seconds) * seconds;
}

/** Folds smaller bars, oldest first, into bars of `seconds`. */
export function aggregate(bars: readonly Candle[], seconds: number): Candle[] {
  const out: Candle[] = [];
  for (const bar of bars) {
    const start = bucketStart(bar.time, seconds);
    const last = out.at(-1);
    if (!last || last.time !== start) {
      out.push({ ...bar, time: start });
      continue;
    }
    last.high = Math.max(last.high, bar.high);
    last.low = Math.min(last.low, bar.low);
    last.close = bar.close;
    if (bar.volume !== undefined)
      last.volume = (last.volume ?? 0) + bar.volume;
  }
  return out;
}

export type Trade = { time: number; price: number; size: number };

/**
 * Puts one trade into the bars: it moves the bar it falls in, or opens the next
 * one. A trade older than the newest bar is dropped: history already holds it.
 * Returns the changed bar, or null when nothing changed.
 */
export function applyTrade(
  bars: Candle[],
  trade: Trade,
  seconds: number,
): Candle | null {
  const start = bucketStart(trade.time, seconds);
  const last = bars.at(-1);
  if (last && start < last.time) return null;
  if (!last || start > last.time) {
    const opened: Candle = {
      time: start,
      open: trade.price,
      high: trade.price,
      low: trade.price,
      close: trade.price,
      volume: trade.size,
    };
    bars.push(opened);
    return opened;
  }
  last.high = Math.max(last.high, trade.price);
  last.low = Math.min(last.low, trade.price);
  last.close = trade.price;
  last.volume = (last.volume ?? 0) + trade.size;
  return last;
}

/** Joins two runs of bars, oldest first; where both hold a time, `newer` wins. */
export function mergeBars(
  older: readonly Candle[],
  newer: readonly Candle[],
): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const bar of older) byTime.set(bar.time, bar);
  for (const bar of newer) byTime.set(bar.time, bar);
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}
