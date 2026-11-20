import { describe, expect, it } from "vitest";

import {
  barsUpTo,
  indexAtOrBefore,
  nextBarTime,
  previousBarTime,
} from "@/lib/charts/replay";
import type { Candle } from "@/lib/data/chart-data";

const bars: Candle[] = [100, 200, 300, 400].map((time) => ({
  time,
  open: 1,
  high: 1,
  low: 1,
  close: 1,
}));

describe("indexAtOrBefore", () => {
  it("finds the bar a moment falls in", () => {
    expect(indexAtOrBefore(bars, 300)).toBe(2);
    expect(indexAtOrBefore(bars, 350)).toBe(2);
    expect(indexAtOrBefore(bars, 99)).toBe(-1);
    expect(indexAtOrBefore(bars, 1_000)).toBe(3);
  });
});

describe("barsUpTo", () => {
  it("shows nothing after the replay's bar", () => {
    expect(barsUpTo(bars, 250).map((one) => one.time)).toEqual([100, 200]);
    expect(barsUpTo(bars, 50)).toEqual([]);
  });

  it("keeps its moment when the interval changes under it", () => {
    // Hourly bars, then the same replay on four-hour bars.
    const fourHours = [0, 14_400, 28_800].map((time) => ({ ...bars[0], time }));
    expect(barsUpTo(fourHours, 18_000).map((one) => one.time)).toEqual([0, 14_400]);
  });
});

describe("stepping", () => {
  it("moves one bar at a time and stops at either end", () => {
    expect(nextBarTime(bars, 200)).toBe(300);
    expect(nextBarTime(bars, 400)).toBeNull();
    expect(previousBarTime(bars, 300)).toBe(200);
    expect(previousBarTime(bars, 100)).toBeNull();
  });
});
