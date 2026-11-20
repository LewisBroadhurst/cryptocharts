export type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1D" | "1W";

export const INTERVALS: readonly {
  id: Interval;
  label: string;
  seconds: number;
}[] = [
  { id: "1m", label: "1m", seconds: 60 },
  { id: "5m", label: "5m", seconds: 300 },
  { id: "15m", label: "15m", seconds: 900 },
  { id: "1h", label: "1h", seconds: 3_600 },
  { id: "4h", label: "4h", seconds: 14_400 },
  { id: "1D", label: "1D", seconds: 86_400 },
  { id: "1W", label: "1W", seconds: 604_800 },
];

export const isInterval = (value: unknown): value is Interval =>
  INTERVALS.some((one) => one.id === value);

export const intervalSeconds = (interval: Interval): number =>
  INTERVALS.find((one) => one.id === interval)?.seconds ?? 3_600;

const DAY_S = 86_400;

/**
 * Maps a moment to a bar's place on the time axis and back. Between two bars a
 * moment falls proportionally; past either end it steps on at the spacing of
 * the bars nearest that end, so a drawing that reaches into the future, or one
 * drawn on another interval, keeps its dates.
 */
export class BarClock {
  readonly times: readonly number[];
  private readonly tailStep: number;
  private readonly headStep: number;

  constructor(times: readonly number[]) {
    this.times = times;
    this.tailStep = BarClock.step(times.slice(-21));
    this.headStep = BarClock.step(times.slice(0, 21));
  }

  private static step(times: readonly number[]): number {
    if (times.length < 2) return DAY_S;
    return Math.max(
      1,
      (times[times.length - 1] - times[0]) / (times.length - 1),
    );
  }

  get length() {
    return this.times.length;
  }

  /** The bar position of a moment: whole at a bar, fractional between. */
  logicalOf(time: number): number {
    const { times } = this;
    const n = times.length;
    if (n === 0) return 0;
    if (time <= times[0]) return (time - times[0]) / this.headStep;
    if (time >= times[n - 1])
      return n - 1 + (time - times[n - 1]) / this.tailStep;
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= time) lo = mid;
      else hi = mid;
    }
    return lo + (time - times[lo]) / (times[hi] - times[lo]);
  }

  timeOf(logical: number): number {
    const { times } = this;
    const n = times.length;
    if (n === 0) return 0;
    if (logical <= 0) return Math.round(times[0] + logical * this.headStep);
    if (logical >= n - 1)
      return Math.round(times[n - 1] + (logical - (n - 1)) * this.tailStep);
    const lo = Math.floor(logical);
    return Math.round(times[lo] + (logical - lo) * (times[lo + 1] - times[lo]));
  }

  barIndex(logical: number): number | null {
    const i = Math.round(logical);
    return i >= 0 && i < this.times.length ? i : null;
  }
}

export type RangeId = "1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "ALL";

export const RANGES: readonly RangeId[] = [
  "1D",
  "5D",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
  "5Y",
  "ALL",
];

export function rangeStart(range: RangeId, last: number): number | null {
  const at = new Date(last * 1000);
  const back = (months: number) => {
    const month = at.getUTCMonth() - months;
    const last = new Date(
      Date.UTC(at.getUTCFullYear(), month + 1, 0),
    ).getUTCDate();
    const day = Math.min(at.getUTCDate(), last);
    return Date.UTC(at.getUTCFullYear(), month, day) / 1000;
  };
  switch (range) {
    case "1D":
      return last - 86_400;
    case "5D":
      return last - 5 * 86_400;
    case "1M":
      return back(1);
    case "3M":
      return back(3);
    case "6M":
      return back(6);
    case "YTD":
      return Date.UTC(at.getUTCFullYear(), 0, 1) / 1000;
    case "1Y":
      return back(12);
    case "5Y":
      return back(60);
    case "ALL":
      return null;
  }
}
