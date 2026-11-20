import {
  channelOffset,
  FIB_EXTENSION_LEVELS,
  FIB_LEVELS,
  fibExtensionPrice,
  fibPrice,
  fibTimeZones,
  NOTE_PLACEHOLDER,
  isPosition,
  isWave,
  type Anchor,
  type Drawing,
} from "@/lib/charts/drawings";

export type Px = { x: number; y: number };

/** Turns a chart point into a place on the pane, in CSS pixels. */
export type Projector = {
  x: (time: number) => number | null;
  y: (price: number) => number | null;
  width: number;
  height: number;
  /** A bar position, whole or not, on the pane; only the chart knows its bars. */
  logicalX?: (logical: number) => number | null;
  /** The bar position of a moment. */
  logicalOf?: (time: number) => number;
};

/** `p0`, `p1` and on: the drawing's points, in the order they were placed. */
export type PointPart = `p${number}`;

export type HitPart =
  PointPart | "cornerA" | "cornerB" | "target" | "stop" | "end" | "body";

export const pointIndex = (part: HitPart): number | null =>
  /^p\d+$/.test(part) ? Number(part.slice(1)) : null;

export const NOTE_FONT_PX = 12;
const NOTE_LINE = 16;
const NOTE_PAD = 8;
const NOTE_CHARS = 32;
/** An average glyph's width at the note size, for laying out before a canvas can measure. */
const GLYPH = 6.6;

/** A note's text in lines of about 32 characters, words kept whole. */
export function wrapText(text: string, chars = NOTE_CHARS): string[] {
  const lines: string[] = [];
  for (const para of (text.trim() || NOTE_PLACEHOLDER).split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (!line) line = word;
      else if (line.length + 1 + word.length <= chars) line += ` ${word}`;
      else {
        lines.push(line);
        line = word;
      }
      while (line.length > chars) {
        lines.push(line.slice(0, chars));
        line = line.slice(chars);
      }
    }
    lines.push(line);
  }
  return lines;
}

export type Box = { x: number; y: number; width: number; height: number };

/**
 * Where a note's box sits. A note's box hangs from its point's top-left; a
 * callout's box is centred on its second point.
 */
export function textBox(
  text: string | undefined,
  at: Px,
  centred: boolean,
): Box {
  const lines = wrapText(text ?? "");
  const width =
    Math.max(...lines.map((line) => line.length)) * GLYPH + NOTE_PAD * 2;
  const height = lines.length * NOTE_LINE + NOTE_PAD;
  return centred
    ? { x: at.x - width / 2, y: at.y - height / 2, width, height }
    : { x: at.x, y: at.y - height, width, height };
}

const boxDistance = (p: Px, box: Box) =>
  Math.hypot(
    Math.max(0, box.x - p.x, p.x - (box.x + box.width)),
    Math.max(0, box.y - p.y, p.y - (box.y + box.height)),
  );

/** The channel's parallel line on the pane: the base line moved through the third point. */
export function channelLines(
  points: readonly Anchor[],
  view: Projector,
): { base: [Px, Px]; parallel: [Px, Px] } | null {
  const [a, b] = points;
  if (!a || !b) return null;
  const offset = channelOffset(points);
  const ends = [
    a,
    b,
    { ...a, price: a.price + offset },
    { ...b, price: b.price + offset },
  ].map((anchor) => project(anchor, view));
  if (ends.some((one) => one === null)) return null;
  const [pa, pb, qa, qb] = ends as Px[];
  return { base: [pa, pb], parallel: [qa, qb] };
}

/** A fib extension's levels on the pane, drawn from the pullback's end to the right. */
export function extensionLevels(points: readonly Anchor[], view: Projector) {
  const [a, b, c] = points;
  if (!a || !b || !c) return null;
  const pa = project(a, view);
  const pc = project(c, view);
  const pb = project(b, view);
  if (!pa || !pb || !pc) return null;
  const left = pc.x;
  const right = pc.x + Math.max(48, Math.abs(pb.x - pa.x));
  const levels = FIB_EXTENSION_LEVELS.map((level) => {
    const price = fibExtensionPrice(a, b, c, level.ratio);
    return { ...level, price, y: view.y(price) };
  });
  return { left, right, levels };
}

/** The x of each Fibonacci time zone that lands on the pane. */
export function timeZoneXs(
  points: readonly Anchor[],
  view: Projector,
): number[] {
  const [a, b] = points;
  if (!a || !b || !view.logicalOf || !view.logicalX) {
    const ends = [a, b].map((one) => (one ? view.x(one.time) : null));
    return ends.filter((x): x is number => x !== null);
  }
  const toX = view.logicalX;
  return fibTimeZones([a, b], view.logicalOf)
    .map((logical) => toX(logical))
    .filter((x): x is number => x !== null && x >= -1 && x <= view.width + 1);
}

/** The arrow mark's size: its head is drawn tip-first from the point. */
export const MARK = { width: 14, height: 20 };

export type Hit = { id: string; part: HitPart; distance: number };

export const HANDLE_RADIUS = 5;

export function distToSegment(p: Px, a: Px, b: Px): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t =
    length2 === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2),
        );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function extendLine(
  a: Px,
  b: Px,
  width: number,
  height: number,
  both: boolean,
): [Px, Px] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return [a, b];
  const reach = (from: Px, sx: number, sy: number): Px => {
    const ts: number[] = [];
    if (sx > 0) ts.push((width - from.x) / sx);
    if (sx < 0) ts.push(-from.x / sx);
    if (sy > 0) ts.push((height - from.y) / sy);
    if (sy < 0) ts.push(-from.y / sy);
    const t = Math.max(0, Math.min(...ts.filter((one) => one >= 0)));
    return Number.isFinite(t)
      ? { x: from.x + sx * t, y: from.y + sy * t }
      : from;
  };
  return [both ? reach(a, -dx, -dy) : a, reach(b, dx, dy)];
}

function project(anchor: Anchor, view: Projector): Px | null {
  const x = view.x(anchor.time);
  const y = view.y(anchor.price);
  return x === null || y === null ? null : { x, y };
}

export function handles(
  drawing: Drawing,
  view: Projector,
): { part: HitPart; at: Px }[] {
  const a = project(drawing.points[0], view);
  if (!a) return [];
  if (drawing.kind === "horizontal")
    return [{ part: "p0", at: { x: view.width / 2, y: a.y } }];
  if (drawing.kind === "vertical")
    return [{ part: "p0", at: { x: a.x, y: view.height / 2 } }];
  if (
    drawing.kind === "horizontalRay" ||
    drawing.kind === "arrowUp" ||
    drawing.kind === "arrowDown"
  )
    return [{ part: "p0", at: a }];
  if (drawing.kind === "note") return [{ part: "p0", at: a }];
  if (drawing.kind === "brush") return [];
  if (isWave(drawing) || drawing.points.length > 2)
    return drawing.points.flatMap((point, i) => {
      const at = project(point, view);
      return at ? [{ part: `p${i}` as PointPart, at }] : [];
    });
  const second = drawing.points[1];
  const b = second ? project(second, view) : null;
  if (!b) return [{ part: "p0", at: a }];
  if (isPosition(drawing)) {
    const target = view.y(drawing.target);
    const stop = view.y(drawing.stop);
    const out: { part: HitPart; at: Px }[] = [{ part: "p0", at: a }];
    if (target !== null)
      out.push({ part: "target", at: { x: a.x, y: target } });
    if (stop !== null) out.push({ part: "stop", at: { x: a.x, y: stop } });
    out.push({ part: "end", at: { x: b.x, y: a.y } });
    return out;
  }
  const ends: { part: HitPart; at: Px }[] = [
    { part: "p0", at: a },
    { part: "p1", at: b },
  ];
  if (drawing.kind === "rectangle")
    ends.push(
      { part: "cornerA", at: { x: a.x, y: b.y } },
      { part: "cornerB", at: { x: b.x, y: a.y } },
    );
  return ends;
}

function bodyDistance(drawing: Drawing, p: Px, view: Projector): number | null {
  const a = project(drawing.points[0], view);
  if (!a) return null;
  switch (drawing.kind) {
    case "horizontal":
      return Math.abs(p.y - a.y);
    case "vertical":
      return Math.abs(p.x - a.x);
    case "horizontalRay":
      return p.x >= a.x - HANDLE_RADIUS ? Math.abs(p.y - a.y) : null;
    case "note":
      return boxDistance(p, textBox(drawing.text, a, false));
    case "arrowUp":
    case "arrowDown": {
      const top = drawing.kind === "arrowUp" ? a.y : a.y - MARK.height;
      const dx = Math.max(0, Math.abs(p.x - a.x) - MARK.width / 2);
      const dy = Math.max(0, top - p.y, p.y - (top + MARK.height));
      return Math.hypot(dx, dy);
    }
  }
  if (drawing.kind === "channel") {
    const lines = channelLines(drawing.points, view);
    if (!lines) return null;
    const { base, parallel } = lines;
    const gap = Math.min(
      distToSegment(p, ...base),
      distToSegment(p, ...parallel),
    );
    const left = Math.min(base[0].x, base[1].x);
    const right = Math.max(base[0].x, base[1].x);
    if (p.x < left || p.x > right || base[0].x === base[1].x) return gap;
    const t = (p.x - base[0].x) / (base[1].x - base[0].x);
    const y1 = base[0].y + t * (base[1].y - base[0].y);
    const y2 = parallel[0].y + t * (parallel[1].y - parallel[0].y);
    return p.y >= Math.min(y1, y2) && p.y <= Math.max(y1, y2) ? 0 : gap;
  }
  if (drawing.kind === "fibExtension") {
    const zone = extensionLevels(drawing.points, view);
    if (!zone) return null;
    const ys = zone.levels
      .map((level) => level.y)
      .filter((y): y is number => y !== null);
    let best = Infinity;
    const path = drawing.points
      .map((point) => project(point, view))
      .filter((one): one is Px => one !== null);
    for (let i = 1; i < path.length; i++)
      best = Math.min(best, distToSegment(p, path[i - 1], path[i]));
    if (ys.length && p.x >= zone.left && p.x <= zone.right) {
      const top = Math.min(...ys);
      const bottom = Math.max(...ys);
      best = Math.min(
        best,
        p.y >= top && p.y <= bottom
          ? 0
          : Math.min(Math.abs(p.y - top), Math.abs(p.y - bottom)),
      );
    }
    return best;
  }
  if (isWave(drawing) || drawing.kind === "brush") {
    let best: number | null = null;
    let last: Px | null = null;
    for (const point of drawing.points) {
      const at = project(point, view);
      if (at && last) {
        const gap = distToSegment(p, last, at);
        if (best === null || gap < best) best = gap;
      }
      last = at;
    }
    return best;
  }
  const b = project(drawing.points[1], view);
  if (!b) return null;
  switch (drawing.kind) {
    case "trend":
    case "arrow":
      return distToSegment(p, a, b);
    case "callout": {
      const box = textBox(drawing.text, b, true);
      return Math.min(boxDistance(p, box), distToSegment(p, a, b));
    }
    case "fibTimeZone": {
      const xs = timeZoneXs(drawing.points, view);
      const near = Math.min(...xs.map((x) => Math.abs(p.x - x)));
      return Math.min(near, distToSegment(p, a, b));
    }
    case "ray":
    case "extended": {
      const [from, to] = extendLine(
        a,
        b,
        view.width,
        view.height,
        drawing.kind === "extended",
      );
      return distToSegment(p, from, to);
    }
    case "rectangle":
    case "measure":
    case "priceRange":
    case "dateRange": {
      const inside =
        p.x >= Math.min(a.x, b.x) &&
        p.x <= Math.max(a.x, b.x) &&
        p.y >= Math.min(a.y, b.y) &&
        p.y <= Math.max(a.y, b.y);
      return inside ? 0 : null;
    }
    case "fib": {
      const left = Math.min(a.x, b.x);
      const right = Math.max(a.x, b.x);
      if (p.x < left - HANDLE_RADIUS || p.x > right + HANDLE_RADIUS)
        return null;
      const ys = FIB_LEVELS.map((level) =>
        view.y(fibPrice(drawing.points[0], drawing.points[1], level.ratio)),
      ).filter((y): y is number => y !== null);
      if (ys.length === 0) return null;
      const top = Math.min(...ys);
      const bottom = Math.max(...ys);
      if (p.y >= top && p.y <= bottom) return 0;
      return Math.min(Math.abs(p.y - top), Math.abs(p.y - bottom));
    }
    case "long":
    case "short": {
      const target = view.y(drawing.target);
      const stop = view.y(drawing.stop);
      if (target === null || stop === null) return null;
      const inside =
        p.x >= Math.min(a.x, b.x) &&
        p.x <= Math.max(a.x, b.x) &&
        p.y >= Math.min(target, stop) &&
        p.y <= Math.max(target, stop);
      return inside ? 0 : null;
    }
  }
}

export function hitTest(
  drawings: readonly Drawing[],
  p: Px,
  view: Projector,
  {
    selected,
    tolerance = 6,
  }: { selected?: string | null; tolerance?: number } = {},
): Hit | null {
  const shown = drawings.filter((drawing) => !drawing.hidden);
  const grab = tolerance + HANDLE_RADIUS - 2;
  const chosen = shown.find((drawing) => drawing.id === selected);
  if (chosen && !chosen.locked) {
    for (const handle of handles(chosen, view)) {
      const distance = Math.hypot(p.x - handle.at.x, p.y - handle.at.y);
      if (distance <= grab)
        return { id: chosen.id, part: handle.part, distance };
    }
  }
  for (let i = shown.length - 1; i >= 0; i--) {
    const drawing = shown[i];
    const distance = bodyDistance(drawing, p, view);
    if (distance !== null && distance <= tolerance)
      return { id: drawing.id, part: "body", distance };
  }
  return null;
}
