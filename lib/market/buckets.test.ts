import { describe, expect, it } from "vitest";

import type { Candle } from "@/lib/data/chart-data";
import { aggregate, applyTrade, bucketStart, mergeBars } from "@/lib/market/buckets";

const at = (iso: string) => Date.parse(iso) / 1000;
const bar = (time: number, close: number): Candle => ({
  time,
  open: close,
  high: close,
  low: close,
  close,
});

describe("bucketStart", () => {
  it("rounds down to the interval", () => {
    expect(bucketStart(at("2026-11-20T10:54:55Z"), 60)).toBe(at("2026-11-20T10:54:00Z"));
    expect(bucketStart(at("2026-11-20T10:54:55Z"), 14_400)).toBe(at("2026-11-20T08:00:00Z"));
  });

  it("starts weeks on Monday 00:00 UTC", () => {
    // 2026-11-20 is a Friday.
    expect(bucketStart(at("2026-11-20T10:00:00Z"), 604_800)).toBe(at("2026-11-16T00:00:00Z"));
    expect(bucketStart(at("2026-11-16T00:00:00Z"), 604_800)).toBe(at("2026-11-16T00:00:00Z"));
  });
});

describe("aggregate", () => {
  it("folds hours into four-hour bars", () => {
    const hours = [10, 12, 8, 11, 9].map((close, i) =>
      bar(at("2026-11-20T00:00:00Z") + i * 3_600, close),
    );
    const [first, second] = aggregate(hours, 14_400);
    expect(first).toEqual({ time: at("2026-11-20T00:00:00Z"), open: 10, high: 12, low: 8, close: 11 });
    expect(second.time).toBe(at("2026-11-20T04:00:00Z"));
    expect(second.close).toBe(9);
  });
});

describe("applyTrade", () => {
  it("moves the newest bar, opens the next, and drops trades history already has", () => {
    const run = [bar(at("2026-11-20T10:54:00Z"), 100)];
    applyTrade(run, { time: at("2026-11-20T10:54:30Z"), price: 103, size: 1 }, 60);
    expect(run[0]).toMatchObject({ high: 103, close: 103 });

    applyTrade(run, { time: at("2026-11-20T10:55:01Z"), price: 101, size: 2 }, 60);
    expect(run).toHaveLength(2);
    expect(run[1]).toMatchObject({ time: at("2026-11-20T10:55:00Z"), open: 101, volume: 2 });

    expect(applyTrade(run, { time: at("2026-11-20T10:53:00Z"), price: 1, size: 1 }, 60)).toBeNull();
    expect(run).toHaveLength(2);
  });
});

describe("mergeBars", () => {
  it("joins runs oldest first, the newer copy winning", () => {
    const merged = mergeBars([bar(1, 1), bar(2, 2)], [bar(2, 20), bar(3, 3)]);
    expect(merged.map((one) => one.close)).toEqual([1, 20, 3]);
  });
});
