import type { Candle } from "@/lib/data/chart-data";

/** How many bars a second each replay speed plays. */
export const REPLAY_SPEEDS = [1, 3, 10] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

/**
 * A replay is held as the time of the newest bar it shows, not an index, so it
 * stays on the same moment when the interval changes or new bars arrive.
 */
export type Replay = {
  /** Start time of the newest bar shown. */
  at: number;
  playing: boolean;
  speed: ReplaySpeed;
};

/** The index of the newest bar starting at or before `time`, or -1. */
export function indexAtOrBefore(candles: readonly Candle[], time: number): number {
  let lo = 0;
  let hi = candles.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time <= time) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** The bars a replay at `time` shows: none after it. */
export function barsUpTo(candles: readonly Candle[], time: number): Candle[] {
  return candles.slice(0, indexAtOrBefore(candles, time) + 1);
}

/** The next bar's time, or null when the replay has caught up with the newest bar. */
export function nextBarTime(candles: readonly Candle[], time: number): number | null {
  const next = candles[indexAtOrBefore(candles, time) + 1];
  return next ? next.time : null;
}

/** The bar before's time, or null at the oldest bar. */
export function previousBarTime(candles: readonly Candle[], time: number): number | null {
  const at = indexAtOrBefore(candles, time);
  return at > 0 ? candles[at - 1].time : null;
}
