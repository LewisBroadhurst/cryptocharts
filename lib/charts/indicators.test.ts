import { describe, expect, it } from "vitest";

import { bollinger, macd, rsi } from "@/lib/charts/indicators";

const bars = (closes: number[]) =>
  closes.map((close, i) => ({
    time: i,
    open: close,
    high: close,
    low: close,
    close,
  }));

const values = (points: { value: number }[]) =>
  points.map((point) => point.value);

describe("bollinger", () => {
  it("bands the window's average by its standard deviation, taken over the whole window", () => {
    // Mean 5; squared gaps 9,1,1,1,0,0,4,16 sum to 32, so the deviation is 2.
    const bands = bollinger(bars([2, 4, 4, 4, 5, 5, 7, 9]), 8, 2);
    expect(bands.middle).toEqual([{ time: 7, value: 5 }]);
    expect(bands.upper).toEqual([{ time: 7, value: 9 }]);
    expect(bands.lower).toEqual([{ time: 7, value: 1 }]);
  });

  it("starts once the window is full and slides with it", () => {
    const bands = bollinger(bars([1, 3, 3, 3]), 2, 2);
    expect(values(bands.middle)).toEqual([2, 3, 3]);
    expect(values(bands.upper)).toEqual([4, 3, 3]);
    expect(values(bands.lower)).toEqual([0, 3, 3]);
    expect(bands.middle[0].time).toBe(1);
  });

  it("draws nothing until there are enough bars", () => {
    expect(bollinger(bars([1, 2]), 3, 2).middle).toEqual([]);
  });
});

describe("rsi", () => {
  it("averages the first moves plainly, then smooths each new one in Wilder's way", () => {
    // Moves +2, -1, +2, 0. First averages: gain 1, loss 0.5 (RS 2).
    // Then gain (1 + 2) / 2 = 1.5, loss 0.25 (RS 6); then 0.75 and 0.125 (RS 6).
    const line = rsi(bars([10, 12, 11, 13, 13]), 2);
    expect(line.map((point) => point.time)).toEqual([2, 3, 4]);
    const [first, second, third] = values(line);
    expect(first).toBeCloseTo(200 / 3);
    expect(second).toBeCloseTo(600 / 7);
    expect(third).toBeCloseTo(600 / 7);
  });

  it("reads 100 when every move is up and 50 when nothing moves", () => {
    expect(values(rsi(bars([1, 2, 3, 4]), 2))).toEqual([100, 100]);
    expect(values(rsi(bars([5, 5, 5]), 2))).toEqual([50]);
  });

  it("draws nothing until there is a move for each bar of the window", () => {
    expect(rsi(bars([1, 2]), 2)).toEqual([]);
  });
});

describe("macd", () => {
  it("is the fast average less the slow, with a signal averaged from it and the gap between them", () => {
    // EMA 1 is the close; EMA 2 (k = 2/3) of 3, 6, 9 is 3, 5, 23/3.
    // MACD from bar 1: 1, 4/3. Its EMA 2: 1, 11/9. Histogram: 4/3 - 11/9 = 1/9.
    const out = macd(bars([3, 6, 9]), 1, 2, 2);
    expect(out.macd.map((point) => point.time)).toEqual([1, 2]);
    expect(values(out.macd)[0]).toBeCloseTo(1);
    expect(values(out.macd)[1]).toBeCloseTo(4 / 3);
    expect(out.signal.map((point) => point.time)).toEqual([2]);
    expect(values(out.signal)[0]).toBeCloseTo(11 / 9);
    expect(values(out.histogram)[0]).toBeCloseTo(1 / 9);
  });

  it("is zero on a flat price and empty until the slow average can be drawn", () => {
    const flat = macd(bars([4, 4, 4, 4]), 2, 3, 1);
    expect(values(flat.macd)).toEqual([0, 0]);
    expect(values(flat.histogram)).toEqual([0, 0]);
    expect(macd(bars([1, 2]), 12, 26, 9).macd).toEqual([]);
  });
});
