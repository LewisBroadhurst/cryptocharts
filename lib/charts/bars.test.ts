import { describe, expect, it } from "vitest";

import { BarClock, isInterval, rangeStart } from "@/lib/charts/bars";

const DAY = 86_400;
const at = (iso: string) => Date.parse(iso) / 1000;
describe("isInterval", () => {
  it("knows the intraday intervals and nothing else", () => {
    expect(["1m", "5m", "15m", "1h", "4h", "1D", "1W"].every(isInterval)).toBe(true);
    expect(isInterval("1M")).toBe(false);
    expect(isInterval("2h")).toBe(false);
  });
});

describe("BarClock", () => {
  const times = [
    at("2026-10-26T00:00:00Z"),
    at("2026-10-27T00:00:00Z"),
    at("2026-10-30T00:00:00Z"),
    at("2026-11-02T00:00:00Z"),
  ];
  const clock = new BarClock(times);

  it("puts each bar at its index", () => {
    times.forEach((time, i) => expect(clock.logicalOf(time)).toBe(i));
  });

  it("places a moment between two bars in proportion to their gap", () => {
    expect(clock.logicalOf(times[1] + 1.5 * DAY)).toBeCloseTo(1.5);
  });

  it("steps past the last bar at the bars' average spacing", () => {
    const step = (times[3] - times[0]) / 3;
    expect(clock.logicalOf(times[3] + 2 * step)).toBeCloseTo(5);
    expect(clock.timeOf(5)).toBe(Math.round(times[3] + 2 * step));
  });

  it("gives back the moment it was given, so a drawing keeps its dates across intervals", () => {
    for (const time of [
      times[0] - 9 * DAY,
      times[1] + DAY,
      times[3] + 30 * DAY,
    ])
      expect(clock.timeOf(clock.logicalOf(time))).toBe(time);
  });

  it("names a bar only inside the data", () => {
    expect(clock.barIndex(2.4)).toBe(2);
    expect(clock.barIndex(-1)).toBeNull();
    expect(clock.barIndex(7)).toBeNull();
  });
});

describe("rangeStart", () => {
  const last = at("2026-11-03T00:00:00Z");

  it.each([
    ["1M", "2026-10-03"],
    ["6M", "2026-05-03"],
    ["YTD", "2026-01-01"],
    ["1Y", "2025-11-03"],
    ["5Y", "2021-11-03"],
  ] as const)("starts %s on %s", (range, day) => {
    expect(
      new Date(rangeStart(range, last)! * 1000).toISOString().slice(0, 10),
    ).toBe(day);
  });

  it.each([
    ["1M", "2026-03-31", "2026-02-28"],
    ["3M", "2026-05-31", "2026-02-28"],
    ["1Y", "2028-02-29", "2027-02-28"],
  ] as const)(
    "keeps %s from %s a whole span, starting on %s",
    (range, from, day) => {
      const start = rangeStart(range, at(`${from}T00:00:00Z`))!;
      expect(new Date(start * 1000).toISOString().slice(0, 10)).toBe(day);
    },
  );

  it("shows everything for All", () => {
    expect(rangeStart("ALL", last)).toBeNull();
  });
});
