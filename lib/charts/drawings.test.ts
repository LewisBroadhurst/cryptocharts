import { describe, expect, it } from "vitest";

import { BarClock } from "@/lib/charts/bars";
import {
  channelOffset,
  DEFAULT_DRAWING_COLOR,
  fibExtensionPrice,
  fibTimeZones,
  MAX_BRUSH_POINTS,
  defaultBracket,
  fibPrice,
  impulseBreaks,
  pointCount,
  positionOutcome,
  positionStats,
  readDrawing,
  settleBracket,
  shiftDrawing,
  type PositionDrawing,
} from "@/lib/charts/drawings";

const position = (
  kind: "long" | "short",
  entry: number,
  target: number,
  stop: number,
): PositionDrawing => ({
  id: "p",
  kind,
  color: "#34d399",
  width: 1,
  style: "solid",
  points: [
    { time: 0, price: entry },
    { time: 10, price: entry },
  ],
  target,
  stop,
});

const bar = (
  time: number,
  low: number,
  high: number,
  close = (low + high) / 2,
) => ({
  time,
  open: close,
  high,
  low,
  close,
});

describe("fibPrice", () => {
  it("puts 0 at the move's end, 1 at its start, and 0.618 where 61.8% of it is given back", () => {
    const from = { time: 0, price: 100 };
    const to = { time: 1, price: 200 };
    expect(fibPrice(from, to, 0)).toBe(200);
    expect(fibPrice(from, to, 1)).toBe(100);
    expect(fibPrice(from, to, 0.618)).toBeCloseTo(138.2);
  });
});

describe("positionStats", () => {
  it("reads a long's reward and risk from its entry, and their ratio", () => {
    const stats = positionStats(position("long", 100, 110, 95));
    expect(stats.rewardPct).toBeCloseTo(10);
    expect(stats.riskPct).toBeCloseTo(5);
    expect(stats.ratio).toBeCloseTo(2);
  });

  it("reads a short the same way, with its target below", () => {
    expect(positionStats(position("short", 100, 85, 105)).ratio).toBeCloseTo(3);
  });
});

describe("positionOutcome", () => {
  const long = position("long", 100, 110, 95);

  it("closes at the target on the first bar that reaches it", () => {
    const outcome = positionOutcome(long, [
      bar(0, 99, 101),
      bar(1, 98, 104),
      bar(2, 101, 111),
    ]);
    expect(outcome).toEqual({
      state: "target",
      exit: { time: 2, price: 110 },
      pnlPct: 10,
    });
  });

  it("closes at the stop when that comes first", () => {
    expect(
      positionOutcome(long, [bar(1, 94, 101), bar(2, 101, 111)]).state,
    ).toBe("stop");
  });

  it("takes the stop when one bar spans both, as nothing says which came first", () => {
    expect(positionOutcome(long, [bar(1, 90, 120)]).state).toBe("stop");
  });

  it("stands open at the last bar it covers when neither is reached", () => {
    const outcome = positionOutcome(long, [
      bar(1, 99, 104, 103),
      bar(11, 80, 130),
    ]);
    expect(outcome.state).toBe("open");
    expect(outcome.exit).toEqual({ time: 1, price: 103 });
    expect(outcome.pnlPct).toBeCloseTo(3);
  });

  it("counts a short's gain as the price falls", () => {
    const outcome = positionOutcome(position("short", 100, 90, 105), [
      bar(1, 89, 101),
    ]);
    expect(outcome.state).toBe("target");
    expect(outcome.pnlPct).toBeCloseTo(10);
  });

  it("waits while no bar has come after the entry", () => {
    expect(positionOutcome(long, [bar(0, 99, 101)]).state).toBe("waiting");
  });
});

describe("brackets", () => {
  it("opens a position at two to one, its stop on the losing side", () => {
    const long = defaultBracket("long", 100, 40);
    expect(long).toEqual({ target: 104, stop: 98 });
    const short = defaultBracket("short", 100, 40);
    expect(short).toEqual({ target: 96, stop: 102 });
  });

  it("keeps a dragged target and stop on their own sides of the entry", () => {
    const settled = settleBracket(position("long", 100, 90, 120));
    expect(settled.target).toBeGreaterThan(100);
    expect(settled.stop).toBeLessThan(100);
  });
});

describe("shiftDrawing", () => {
  it("moves a position's target and stop with its entry", () => {
    const moved = shiftDrawing(position("long", 100, 110, 95), (anchor) => ({
      time: anchor.time + 1,
      price: anchor.price + 5,
    })) as PositionDrawing;
    expect(moved.points.map((point) => point.time)).toEqual([1, 11]);
    expect([moved.target, moved.stop]).toEqual([115, 100]);
  });
});

describe("readDrawing", () => {
  it("reads back what was saved", () => {
    const saved = position("short", 100, 90, 105);
    expect(readDrawing(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it("puts a colour it cannot draw back to the default", () => {
    const saved = { ...position("long", 1, 2, 0), kind: "trend", color: "red" };
    expect(readDrawing(saved)?.color).toBe(DEFAULT_DRAWING_COLOR);
  });

  it.each([
    ["an unknown tool", { id: "x", kind: "pitchfork", points: [] }],
    [
      "a line with one point",
      { id: "x", kind: "trend", points: [{ time: 1, price: 2 }] },
    ],
    [
      "a point with no price",
      { id: "x", kind: "horizontal", points: [{ time: 1 }] },
    ],
    [
      "a position with no stop",
      { ...position("long", 1, 2, 0), stop: undefined },
    ],
  ])("drops %s", (_, value) => {
    expect(readDrawing(value)).toBeNull();
  });
});

const turns = (...prices: number[]) =>
  prices.map((price, time) => ({ time, price }));

describe("impulseBreaks", () => {
  it("passes a count that keeps every rule, up or down", () => {
    expect(impulseBreaks(turns(10, 20, 15, 35, 25, 32))).toEqual([]);
    expect(impulseBreaks(turns(40, 30, 35, 15, 25, 18))).toEqual([]);
  });

  it("names wave 2 going past the start of wave 1", () => {
    expect(impulseBreaks(turns(10, 20, 9, 35, 25, 32))).toEqual([
      "Wave 2 goes past the start of wave 1",
    ]);
  });

  it("names wave 3 when it is the shortest of 1, 3 and 5", () => {
    expect(impulseBreaks(turns(10, 20, 18, 25, 22, 40))).toEqual([
      "Wave 3 is the shortest",
    ]);
  });

  it("names wave 4 dipping into wave 1's range", () => {
    expect(impulseBreaks(turns(10, 20, 15, 35, 19, 32))).toEqual([
      "Wave 4 overlaps wave 1",
    ]);
  });

  it("judges only a finished count", () => {
    expect(impulseBreaks(turns(10, 20, 9))).toEqual([]);
  });
});

describe("wave and arrow drawings", () => {
  it("are placed with one point per turn, or one or two for arrows", () => {
    expect(pointCount("elliottImpulse")).toBe(6);
    expect(pointCount("elliottCorrection")).toBe(4);
    expect(pointCount("elliottTriangle")).toBe(6);
    expect(pointCount("elliottCombo")).toBe(4);
    expect(pointCount("arrow")).toBe(2);
    expect(pointCount("arrowUp")).toBe(1);
  });

  it("read back from storage only with the right number of points", () => {
    const wave = {
      id: "w",
      kind: "elliottCorrection",
      color: "#38bdf8",
      width: 2,
      style: "solid",
      points: turns(30, 20, 25, 12),
    };
    expect(readDrawing(wave)).toEqual(wave);
    expect(readDrawing({ ...wave, points: turns(30, 20, 25) })).toBeNull();
    const mark = { ...wave, kind: "arrowUp", points: turns(5) };
    expect(readDrawing(mark)).toEqual(mark);
  });
});

describe("fib extension and time zones", () => {
  it("projects the first move again from the pullback's end", () => {
    const [a, b, c] = turns(100, 150, 120);
    expect(fibExtensionPrice(a, b, c, 1)).toBe(170);
    expect(fibExtensionPrice(a, b, c, 1.618)).toBeCloseTo(200.9);
    expect(fibExtensionPrice(a, b, c, 0)).toBe(120);
  });

  it("puts each zone a Fibonacci count of the first gap from the start", () => {
    const day = 86_400;
    const clock = new BarClock(Array.from({ length: 300 }, (_, i) => i * day));
    const zones = fibTimeZones(
      [
        { time: 10 * day, price: 1 },
        { time: 14 * day, price: 1 },
      ],
      (time) => clock.logicalOf(time),
    );
    expect(zones.slice(0, 7)).toEqual([10, 14, 18, 22, 30, 42, 62]);
  });

  it("draws one line when both points sit on the same bar", () => {
    const clock = new BarClock([0, 86_400]);
    const at = { time: 0, price: 1 };
    expect(fibTimeZones([at, at], (time) => clock.logicalOf(time))).toEqual([
      0,
    ]);
  });
});

describe("channelOffset", () => {
  it("is the third point's distance from the base line at its moment", () => {
    // Base runs 100 to 120 over 10 units: at time 5 it is at 110.
    const points = [
      { time: 0, price: 100 },
      { time: 10, price: 120 },
      { time: 5, price: 95 },
    ];
    expect(channelOffset(points)).toBe(-15);
  });
});

describe("notes and brush strokes in storage", () => {
  const base = { id: "n", color: "#38bdf8", width: 2, style: "solid" };

  it("keeps a note's text, cut to the limit, and gives one without text an empty one", () => {
    const note = { ...base, kind: "note", points: turns(5), text: "Breakout" };
    expect(readDrawing(note)).toEqual(note);
    expect(readDrawing({ ...note, text: "x".repeat(400) })?.text).toHaveLength(
      280,
    );
    expect(readDrawing({ ...note, text: 7 })?.text).toBe("");
  });

  it("drops text from a drawing that has none to show", () => {
    const line = { ...base, kind: "trend", points: turns(1, 2), text: "hi" };
    expect(readDrawing(line)).not.toHaveProperty("text");
  });

  it("reads a brush of any length from two points up to the limit", () => {
    const brush = { ...base, kind: "brush", points: turns(1, 2, 3, 4, 5) };
    expect(readDrawing(brush)?.points).toHaveLength(5);
    expect(readDrawing({ ...brush, points: turns(1) })).toBeNull();
    expect(
      readDrawing({
        ...brush,
        points: turns(...Array(MAX_BRUSH_POINTS + 1).fill(1)),
      }),
    ).toBeNull();
  });
});
