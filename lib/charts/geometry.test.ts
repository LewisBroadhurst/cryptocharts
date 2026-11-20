import { describe, expect, it } from "vitest";

import type { Drawing } from "@/lib/charts/drawings";
import {
  distToSegment,
  extendLine,
  handles,
  hitTest,
  textBox,
  wrapText,
  type Projector,
} from "@/lib/charts/geometry";

const view: Projector = {
  x: (time) => time,
  y: (price) => price,
  width: 400,
  height: 300,
};

const line = (
  id: string,
  kind: Drawing["kind"],
  a: [number, number],
  b: [number, number],
) =>
  ({
    id,
    kind,
    color: "#fff",
    width: 2,
    style: "solid",
    points: [
      { time: a[0], price: a[1] },
      { time: b[0], price: b[1] },
    ],
  }) as Drawing;

describe("distToSegment", () => {
  it("measures to the nearest point on the segment, its ends included", () => {
    expect(distToSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(
      5,
    );
    expect(
      distToSegment({ x: 13, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    ).toBe(5);
  });
});

describe("extendLine", () => {
  it("runs a ray on past its second point to the pane's edge", () => {
    expect(
      extendLine({ x: 0, y: 0 }, { x: 10, y: 10 }, 400, 300, false),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 300, y: 300 },
    ]);
  });

  it("runs an extended line both ways", () => {
    const [from, to] = extendLine(
      { x: 100, y: 50 },
      { x: 200, y: 50 },
      400,
      300,
      true,
    );
    expect([from.x, to.x]).toEqual([0, 400]);
  });
});

describe("hitTest", () => {
  const trend = line("t", "trend", [0, 0], [100, 100]);
  const later = line("l", "trend", [0, 100], [100, 0]);

  it("finds a line within a few pixels of it, and nothing farther off", () => {
    expect(hitTest([trend], { x: 52, y: 48 }, view)?.id).toBe("t");
    expect(hitTest([trend], { x: 70, y: 40 }, view)).toBeNull();
  });

  it("picks the latest drawn where two cross", () => {
    expect(hitTest([trend, later], { x: 50, y: 50 }, view)?.id).toBe("l");
  });

  it("grabs a picked drawing's handle before any body under it", () => {
    expect(
      hitTest([trend, later], { x: 1, y: 1 }, view, { selected: "t" }),
    ).toMatchObject({
      id: "t",
      part: "p0",
    });
  });

  it("leaves a locked drawing's handles alone, but still finds it", () => {
    const locked = { ...trend, locked: true };
    expect(
      hitTest([locked], { x: 1, y: 1 }, view, { selected: "t" })?.part,
    ).toBe("body");
  });

  it("passes over a hidden drawing", () => {
    expect(
      hitTest([{ ...trend, hidden: true }], { x: 50, y: 50 }, view),
    ).toBeNull();
  });

  it("finds a horizontal line anywhere across the pane", () => {
    const flat = {
      ...trend,
      kind: "horizontal",
      points: [{ time: 10, price: 80 }],
    } as Drawing;
    expect(hitTest([flat], { x: 390, y: 82 }, view)?.id).toBe("t");
  });

  it("finds a retracement between its two points, and nothing in the open chart past them", () => {
    const fib = line("f", "fib", [100, 200], [200, 100]);
    expect(hitTest([fib], { x: 150, y: 150 }, view)?.id).toBe("f");
    expect(hitTest([fib], { x: 300, y: 150 }, view)).toBeNull();
  });

  it("finds a position anywhere inside its box", () => {
    const long = {
      ...line("p", "long", [100, 150], [200, 150]),
      target: 100,
      stop: 175,
    } as Drawing;
    expect(hitTest([long], { x: 150, y: 120 }, view)?.id).toBe("p");
    expect(hitTest([long], { x: 150, y: 200 }, view)).toBeNull();
  });
});

describe("wave counts and arrow marks", () => {
  const wave = {
    id: "w",
    kind: "elliottCorrection",
    color: "#fff",
    width: 2,
    style: "solid",
    points: [
      { time: 0, price: 0 },
      { time: 100, price: 100 },
      { time: 200, price: 50 },
      { time: 300, price: 150 },
    ],
  } as Drawing;

  it("is hit along any leg, not only the first", () => {
    expect(hitTest([wave], { x: 250, y: 100 }, view)?.part).toBe("body");
    expect(hitTest([wave], { x: 250, y: 140 }, view)).toBeNull();
  });

  it("offers a handle at every turn once picked", () => {
    expect(handles(wave, view).map((one) => one.part)).toEqual([
      "p0",
      "p1",
      "p2",
      "p3",
    ]);
    expect(
      hitTest([wave], { x: 200, y: 50 }, view, { selected: "w" })?.part,
    ).toBe("p2");
  });

  it("hits an up mark below its tip and a down mark above it", () => {
    const mark = (kind: "arrowUp" | "arrowDown") =>
      ({
        id: kind,
        kind,
        color: "#fff",
        width: 2,
        style: "solid",
        points: [{ time: 100, price: 100 }],
      }) as Drawing;
    expect(hitTest([mark("arrowUp")], { x: 100, y: 115 }, view)).not.toBeNull();
    expect(hitTest([mark("arrowUp")], { x: 100, y: 80 }, view)).toBeNull();
    expect(
      hitTest([mark("arrowDown")], { x: 100, y: 85 }, view),
    ).not.toBeNull();
  });
});

describe("notes", () => {
  it("wraps text at word breaks and shows a placeholder when empty", () => {
    expect(wrapText("one two three", 8)).toEqual(["one two", "three"]);
    expect(wrapText("   ")).toEqual(["Note"]);
    expect(wrapText("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("hangs a note's box from its point and is hit inside it", () => {
    const note = {
      id: "n",
      kind: "note",
      color: "#fff",
      width: 2,
      style: "solid",
      points: [{ time: 100, price: 100 }],
      text: "Support",
    } as Drawing;
    const box = textBox("Support", { x: 100, y: 100 }, false);
    expect(box.y + box.height).toBe(100);
    expect(hitTest([note], { x: 110, y: 95 }, view)?.id).toBe("n");
    expect(hitTest([note], { x: 110, y: 130 }, view)).toBeNull();
  });
});

describe("parallel channel", () => {
  const channel = {
    id: "c",
    kind: "channel",
    color: "#fff",
    width: 2,
    style: "solid",
    points: [
      { time: 0, price: 100 },
      { time: 200, price: 100 },
      { time: 100, price: 160 },
    ],
  } as Drawing;

  it("is hit anywhere in the band between its lines", () => {
    expect(hitTest([channel], { x: 100, y: 130 }, view)?.part).toBe("body");
    expect(hitTest([channel], { x: 100, y: 200 }, view)).toBeNull();
  });

  it("offers a handle at each of its three points", () => {
    expect(handles(channel, view).map((one) => one.part)).toEqual([
      "p0",
      "p1",
      "p2",
    ]);
  });
});
