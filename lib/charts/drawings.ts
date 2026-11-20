import type { Candle } from "@/lib/data/chart-data";
import { BarClock } from "@/lib/charts/bars";

export type Anchor = { time: number; price: number };

export type LineStyle = "solid" | "dashed" | "dotted";

export type DrawingKind =
  | "trend"
  | "ray"
  | "extended"
  | "horizontal"
  | "horizontalRay"
  | "vertical"
  | "rectangle"
  | "fib"
  | "long"
  | "short"
  | "measure"
  | "arrow"
  | "arrowUp"
  | "arrowDown"
  | "elliottImpulse"
  | "elliottCorrection"
  | "elliottTriangle"
  | "elliottCombo"
  | "note"
  | "callout"
  | "channel"
  | "fibExtension"
  | "fibTimeZone"
  | "brush"
  | "priceRange"
  | "dateRange";

export type WaveKind =
  "elliottImpulse" | "elliottCorrection" | "elliottTriangle" | "elliottCombo";

type Common = {
  id: string;
  color: string;
  width: 1 | 2 | 3 | 4;
  style: LineStyle;
  locked?: boolean;
  hidden?: boolean;
  /** What a note or callout says. */
  text?: string;
};

export type PointDrawing = Common & {
  kind:
    | "horizontal"
    | "horizontalRay"
    | "vertical"
    | "arrowUp"
    | "arrowDown"
    | "note";
  points: [Anchor];
};

export type SpanDrawing = Common & {
  kind:
    | "trend"
    | "ray"
    | "extended"
    | "rectangle"
    | "fib"
    | "measure"
    | "arrow"
    | "callout"
    | "fibTimeZone"
    | "priceRange"
    | "dateRange";
  points: [Anchor, Anchor];
};

export type PositionDrawing = Common & {
  kind: "long" | "short";
  points: [Anchor, Anchor];
  target: number;
  stop: number;
};

/** A wave count: one point per turn, the first where the move starts. */
export type WaveDrawing = Common & {
  kind: WaveKind;
  points: Anchor[];
};

/**
 * A drawing of three or more points: a channel's base line and a point its
 * parallel runs through, a fib extension's move and pullback, or a brush stroke.
 */
export type PathDrawing = Common & {
  kind: "channel" | "fibExtension" | "brush";
  points: Anchor[];
};

export type Drawing =
  PointDrawing | SpanDrawing | PositionDrawing | WaveDrawing | PathDrawing;

export const MAX_TEXT = 280;
export const MAX_BRUSH_POINTS = 1500;
export const NOTE_PLACEHOLDER = "Note";

export const hasText = (kind: DrawingKind) =>
  kind === "note" || kind === "callout";

export const ONE_POINT: ReadonlySet<DrawingKind> = new Set([
  "horizontal",
  "horizontalRay",
  "vertical",
  "arrowUp",
  "arrowDown",
  "note",
]);

/** The label at each turn of a wave count; the start has none. */
export const WAVE_LABELS: Record<WaveKind, readonly string[]> = {
  elliottImpulse: ["", "1", "2", "3", "4", "5"],
  elliottCorrection: ["", "A", "B", "C"],
  elliottTriangle: ["", "A", "B", "C", "D", "E"],
  elliottCombo: ["", "W", "X", "Y"],
};

export const isWave = (drawing: Drawing): drawing is WaveDrawing =>
  drawing.kind in WAVE_LABELS;

export const isWaveKind = (kind: DrawingKind): kind is WaveKind =>
  kind in WAVE_LABELS;

/** How many points a drawing of this kind is placed with. */
export function pointCount(kind: DrawingKind): number {
  if (isWaveKind(kind)) return WAVE_LABELS[kind].length;
  if (kind === "channel" || kind === "fibExtension") return 3;
  // A brush takes as many points as its stroke lays.
  if (kind === "brush") return Infinity;
  return ONE_POINT.has(kind) ? 1 : 2;
}

/**
 * The rules an impulse count breaks, in plain words. Wave 2 never goes past
 * the start of wave 1, wave 3 is never the shortest of 1, 3 and 5, and wave 4
 * never enters wave 1's range. An empty list means the count holds.
 */
export function impulseBreaks(points: readonly Anchor[]): string[] {
  if (points.length !== 6) return [];
  const [p0, p1, p2, p3, p4, p5] = points.map((point) => point.price);
  const up = p1 > p0;
  const beyond = (a: number, b: number) => (up ? a < b : a > b);
  const broken: string[] = [];
  if (beyond(p2, p0) || p2 === p0)
    broken.push("Wave 2 goes past the start of wave 1");
  const one = Math.abs(p1 - p0);
  const three = Math.abs(p3 - p2);
  const five = Math.abs(p5 - p4);
  if (three < one && three < five) broken.push("Wave 3 is the shortest");
  if (beyond(p4, p1) || p4 === p1) broken.push("Wave 4 overlaps wave 1");
  return broken;
}

export const isPosition = (drawing: Drawing): drawing is PositionDrawing =>
  drawing.kind === "long" || drawing.kind === "short";

export const TOOL_NAMES: Record<DrawingKind, string> = {
  trend: "Trend line",
  ray: "Ray",
  extended: "Extended line",
  horizontal: "Horizontal line",
  horizontalRay: "Horizontal ray",
  vertical: "Vertical line",
  rectangle: "Rectangle",
  fib: "Fib retracement",
  long: "Long position",
  short: "Short position",
  measure: "Measure",
  arrow: "Arrow",
  arrowUp: "Up arrow",
  arrowDown: "Down arrow",
  elliottImpulse: "Elliott impulse (12345)",
  elliottCorrection: "Elliott correction (ABC)",
  elliottTriangle: "Elliott triangle (ABCDE)",
  elliottCombo: "Elliott combo (WXY)",
  note: "Note",
  callout: "Callout",
  channel: "Parallel channel",
  fibExtension: "Fib extension",
  fibTimeZone: "Fib time zone",
  brush: "Brush",
  priceRange: "Price range",
  dateRange: "Date range",
};

export const DEFAULT_DRAWING_COLOR = "#38bdf8";

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const DRAWING_COLORS = [
  "#38bdf8",
  "#e5e5e5",
  "#facc15",
  "#34d399",
  "#fb7185",
  "#a78bfa",
  "#fb923c",
  "#f472b6",
] as const;

export const KIND_COLOR: Partial<Record<DrawingKind, string>> = {
  fib: "#a3a3a3",
  long: "#34d399",
  short: "#fb7185",
  measure: "#38bdf8",
  arrowUp: "#34d399",
  arrowDown: "#fb7185",
  fibExtension: "#a3a3a3",
  fibTimeZone: "#a3a3a3",
  priceRange: "#38bdf8",
  dateRange: "#38bdf8",
};

export type FibLevel = { ratio: number; color: string };

export const FIB_LEVELS: readonly FibLevel[] = [
  { ratio: 0, color: "#a3a3a3" },
  { ratio: 0.236, color: "#f87171" },
  { ratio: 0.382, color: "#fb923c" },
  { ratio: 0.5, color: "#34d399" },
  { ratio: 0.618, color: "#2dd4bf" },
  { ratio: 0.786, color: "#38bdf8" },
  { ratio: 1, color: "#a3a3a3" },
  { ratio: 1.618, color: "#a78bfa" },
];

/** Trend-based extension levels: the pullback's end plus a share of the first move. */
export const FIB_EXTENSION_LEVELS: readonly FibLevel[] = [
  { ratio: 0, color: "#a3a3a3" },
  { ratio: 0.382, color: "#fb923c" },
  { ratio: 0.618, color: "#2dd4bf" },
  { ratio: 1, color: "#38bdf8" },
  { ratio: 1.272, color: "#34d399" },
  { ratio: 1.618, color: "#a78bfa" },
  { ratio: 2, color: "#f472b6" },
  { ratio: 2.618, color: "#f87171" },
];

/** The price at an extension level: from the pullback's end `c`, the move `a` to `b` again, scaled. */
export const fibExtensionPrice = (
  a: Anchor,
  b: Anchor,
  c: Anchor,
  ratio: number,
) => c.price + (b.price - a.price) * ratio;

/** Fibonacci numbers of bars from the first point: 0, 1, 2, 3, 5, 8 and on. */
export const FIB_TIME_STEPS = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];

/**
 * The bars a time zone falls on, as logical bar positions. The gap between
 * the two points is the unit; zone n sits n Fibonacci units on from the first.
 */
export function fibTimeZones(
  [from, to]: readonly [Anchor, Anchor],
  logicalOf: (time: number) => number,
): number[] {
  const start = logicalOf(from.time);
  const unit = logicalOf(to.time) - start;
  if (Math.abs(unit) < 0.5) return [start];
  return FIB_TIME_STEPS.map((step) => start + unit * step);
}

/**
 * How far the channel's parallel line sits from its base line, in price: the
 * base runs from the first point to the second, the parallel through the third.
 */
export function channelOffset(points: readonly Anchor[]): number {
  const [a, b, c] = points;
  if (!a || !b || !c) return 0;
  const span = b.time - a.time;
  const base =
    span === 0
      ? a.price
      : a.price + ((c.time - a.time) / span) * (b.price - a.price);
  return c.price - base;
}

/**
 * The price at a level. A retracement runs from the move's start to its end:
 * the end is 0, the start is 1, so 0.618 is the price that gives back 61.8%
 * of the move.
 */
export const fibPrice = (from: Anchor, to: Anchor, ratio: number) =>
  to.price + (from.price - to.price) * ratio;

export type PositionStats = {
  /** The target's distance from the entry, in price and as a share of it. */
  reward: number;
  rewardPct: number;
  risk: number;
  riskPct: number;
  /** Reward over risk: 2 means the target is twice as far as the stop. */
  ratio: number;
};

export function positionStats(position: PositionDrawing): PositionStats {
  const entry = position.points[0].price;
  const reward = Math.abs(position.target - entry);
  const risk = Math.abs(entry - position.stop);
  return {
    reward,
    rewardPct: entry ? (reward / entry) * 100 : 0,
    risk,
    riskPct: entry ? (risk / entry) * 100 : 0,
    ratio: risk ? reward / risk : 0,
  };
}

export type PositionOutcome = {
  state: "target" | "stop" | "open" | "waiting";
  exit: Anchor | null;
  /** The move from the entry to the exit, as a share of the entry, for the side held. */
  pnlPct: number;
};

export function positionOutcome(
  position: PositionDrawing,
  candles: readonly Candle[],
): PositionOutcome {
  const [entry, end] = position.points;
  const long = position.kind === "long";
  const from = Math.min(entry.time, end.time);
  const to = Math.max(entry.time, end.time);
  const sign = long ? 1 : -1;
  const pnl = (price: number) =>
    entry.price ? ((price - entry.price) / entry.price) * 100 * sign : 0;

  let last: Candle | null = null;
  for (const bar of candles) {
    if (bar.time <= from) continue;
    if (bar.time > to) break;
    last = bar;
    const stopHit = long ? bar.low <= position.stop : bar.high >= position.stop;
    const targetHit = long
      ? bar.high >= position.target
      : bar.low <= position.target;
    if (stopHit)
      return {
        state: "stop",
        exit: { time: bar.time, price: position.stop },
        pnlPct: pnl(position.stop),
      };
    if (targetHit)
      return {
        state: "target",
        exit: { time: bar.time, price: position.target },
        pnlPct: pnl(position.target),
      };
  }
  if (!last) return { state: "waiting", exit: null, pnlPct: 0 };
  return {
    state: "open",
    exit: { time: last.time, price: last.close },
    pnlPct: pnl(last.close),
  };
}

export function defaultBracket(
  kind: "long" | "short",
  entry: number,
  visibleRange: number,
): { target: number; stop: number } {
  const step = Math.max(visibleRange / 20, Math.abs(entry) * 0.005);
  const sign = kind === "long" ? 1 : -1;
  return { target: entry + 2 * step * sign, stop: entry - step * sign };
}

export function settleBracket(position: PositionDrawing): PositionDrawing {
  const entry = position.points[0].price;
  const gap = Math.max(Math.abs(entry) * 0.0005, 1e-6);
  const long = position.kind === "long";
  const target = long
    ? Math.max(position.target, entry + gap)
    : Math.min(position.target, entry - gap);
  const stop = long
    ? Math.min(position.stop, entry - gap)
    : Math.max(position.stop, entry + gap);
  return { ...position, target, stop };
}

export type Measurement = {
  change: number;
  changePct: number;
  bars: number;
  days: number;
};

export function measure(
  [from, to]: readonly [Anchor, Anchor],
  clock: BarClock,
): Measurement {
  const change = to.price - from.price;
  return {
    change,
    changePct: from.price ? (change / from.price) * 100 : 0,
    bars: Math.round(clock.logicalOf(to.time) - clock.logicalOf(from.time)),
    days: Math.round((to.time - from.time) / 86_400),
  };
}

let made = 0;

export function drawingId(): string {
  made += 1;
  return `d${Date.now().toString(36)}${made.toString(36)}`;
}

export function shiftDrawing(
  drawing: Drawing,
  shift: (anchor: Anchor) => Anchor,
): Drawing {
  if (isPosition(drawing)) {
    const entry = drawing.points[0];
    const moved = shift(entry);
    const delta = moved.price - entry.price;
    return {
      ...drawing,
      points: [moved, shift(drawing.points[1])],
      target: drawing.target + delta,
      stop: drawing.stop + delta,
    };
  }
  return {
    ...drawing,
    points: drawing.points.map(shift) as typeof drawing.points,
  } as Drawing;
}

const KINDS = new Set<string>(Object.keys(TOOL_NAMES));
const STYLES = new Set<string>(["solid", "dashed", "dotted"]);

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function readAnchor(value: unknown): Anchor | null {
  if (typeof value !== "object" || value === null) return null;
  const { time, price } = value as Record<string, unknown>;
  return finite(time) && finite(price) ? { time, price } : null;
}

export function readDrawing(value: unknown): Drawing | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.kind !== "string") return null;
  if (!KINDS.has(raw.kind) || !Array.isArray(raw.points)) return null;
  const points = raw.points.map(readAnchor);
  if (points.some((point) => point === null)) return null;
  const kind = raw.kind as DrawingKind;
  if (kind === "brush") {
    if (points.length < 2 || points.length > MAX_BRUSH_POINTS) return null;
  } else if (points.length !== pointCount(kind)) return null;
  const width = [1, 2, 3, 4].includes(raw.width as number)
    ? (raw.width as 1 | 2 | 3 | 4)
    : 2;
  const common = {
    id: raw.id,
    color:
      typeof raw.color === "string" && HEX_COLOR.test(raw.color)
        ? raw.color
        : DEFAULT_DRAWING_COLOR,
    width,
    style: STYLES.has(raw.style as string) ? (raw.style as LineStyle) : "solid",
    ...(raw.locked === true && { locked: true }),
    ...(raw.hidden === true && { hidden: true }),
    ...(hasText(kind) && {
      text: typeof raw.text === "string" ? raw.text.slice(0, MAX_TEXT) : "",
    }),
  };
  if (kind === "long" || kind === "short") {
    if (!finite(raw.target) || !finite(raw.stop)) return null;
    return {
      ...common,
      kind,
      points: points as [Anchor, Anchor],
      target: raw.target,
      stop: raw.stop,
    };
  }
  return { ...common, kind, points } as Drawing;
}
