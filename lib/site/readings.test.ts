import { describe, expect, it } from "vitest";

import type { Candle } from "@/lib/data/chart-data";
import { crossReading, rsiReading, rsiZone, smaReading } from "@/lib/site/readings";

const DAY = 86_400;
const bars = (closes: number[]): Candle[] =>
  closes.map((close, i) => ({ time: i * DAY, open: close, high: close, low: close, close }));

describe("rsiReading", () => {
  it("reads a steady rise as overbought and a fall as oversold", () => {
    const up = rsiReading(bars(Array.from({ length: 60 }, (_, i) => 100 + i)))!;
    expect(up.value).toBe(100);
    expect(up.zone).toBe("overbought");
    expect(up.lastOverbought).toBe(59 * DAY);
    expect(up.lastOversold).toBeNull();

    const down = rsiReading(bars(Array.from({ length: 60 }, (_, i) => 200 - i)))!;
    expect(down.zone).toBe("oversold");
  });

  it("names the zones at the usual levels", () => {
    expect(rsiZone(70)).toBe("overbought");
    expect(rsiZone(69.9)).toBe("neutral");
    expect(rsiZone(30)).toBe("oversold");
  });

  it("has nothing to say with too few bars", () => {
    expect(rsiReading(bars([1, 2, 3]))).toBeNull();
  });
});

describe("smaReading", () => {
  it("measures the distance from the average and how long the price has been on its side", () => {
    // 10 bars at 100, then 3 at 110: the 5-bar average is 106 at the end.
    const reading = smaReading(bars([...Array(10).fill(100), 90, 110, 110, 110]), 5)!;
    expect(reading.sma).toBeCloseTo((100 + 90 + 110 * 3) / 5);
    expect(reading.above).toBe(true);
    expect(reading.distancePct).toBeCloseTo((110 / reading.sma - 1) * 100);
    expect(reading.since).toBe(11 * DAY);
    expect(reading.days).toBe(3);
    // Before the dip it sat on the average (a close equal to it counts as
    // above) for 6 bars: a longer run above, ending the day before the dip.
    expect(reading.longerRunEnded).toBe(9 * DAY);
  });
});

describe("crossReading", () => {
  it("dates each cross of the 50-day over the 200-day, newest first", () => {
    const closes = [
      ...Array.from({ length: 250 }, () => 100),
      ...Array.from({ length: 60 }, (_, i) => 100 + i), // rises: golden cross
      ...Array.from({ length: 150 }, (_, i) => 160 - i), // falls: death cross
    ];
    const reading = crossReading(bars(closes))!;
    expect(reading.crosses.map((cross) => cross.kind)).toEqual(["death", "golden"]);
    expect(reading.state).toBe("death");
    expect(reading.crosses[1].time).toBe(251 * DAY);
    expect(reading.gapPct).toBeLessThan(0);
  });

  it("needs 200 bars", () => {
    expect(crossReading(bars(Array(199).fill(1)))).toBeNull();
  });
});
