import { describe, expect, it } from "vitest";

import {
  DEFAULT_LAYOUT,
  readDrawings,
  readLayout,
} from "@/lib/charts/chart-storage";

describe("readLayout", () => {
  it("falls back to the default for anything it cannot read", () => {
    expect(readLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(
      readLayout({ interval: "4H", style: "renko", magnet: "yes" }),
    ).toEqual({
      ...DEFAULT_LAYOUT,
      studies: DEFAULT_LAYOUT.studies,
    });
  });

  it("keeps the averages a reader set, clamped to a length the chart can draw", () => {
    const layout = readLayout({
      interval: "1W",
      studies: [
        { id: "a", kind: "sma", length: 9000, color: "#38bdf8", width: 3 },
        { id: "b", kind: "stochastic", length: 14 },
        { id: "c", kind: "__proto__", length: 14 },
      ],
    });
    expect(layout.interval).toBe("1W");
    expect(layout.studies).toEqual([
      { id: "a", kind: "sma", length: 500, color: "#38bdf8", width: 3 },
    ]);
  });

  it("reads the bands and the lower-pane studies, filling MACD's other lengths when they are missing or junk", () => {
    const layout = readLayout({
      studies: [
        { id: "b", kind: "bb", length: 20, color: "#fb923c", width: 1 },
        { id: "r", kind: "rsi", length: 14, color: "#a78bfa", width: 2 },
        {
          id: "m",
          kind: "macd",
          length: 12,
          slow: 0,
          signal: "nine",
          color: "#38bdf8",
          width: 2,
          hidden: true,
        },
      ],
    });
    expect(layout.studies).toEqual([
      { id: "b", kind: "bb", length: 20, color: "#fb923c", width: 1 },
      { id: "r", kind: "rsi", length: 14, color: "#a78bfa", width: 2 },
      {
        id: "m",
        kind: "macd",
        length: 12,
        slow: 1,
        signal: 9,
        color: "#38bdf8",
        width: 2,
        hidden: true,
      },
    ]);
  });

  it("keeps a chart with every average removed empty", () => {
    expect(readLayout({ studies: [] }).studies).toEqual([]);
  });
});

describe("readDrawings", () => {
  it("drops what it cannot draw and keeps the rest", () => {
    const kept = {
      id: "h",
      kind: "horizontal",
      color: "#ffffff",
      width: 1,
      style: "dashed",
      points: [{ time: 1, price: 2 }],
    };
    expect(readDrawings([kept, { id: "x" }, "junk"])).toEqual([kept]);
    expect(readDrawings({ not: "a list" })).toEqual([]);
  });
});
