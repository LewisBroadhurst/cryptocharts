import { BarClock } from "@/lib/charts/bars";
import { signedFixed, signedPct } from "@/lib/format";
import {
  FIB_LEVELS,
  fibPrice,
  FIB_TIME_STEPS,
  impulseBreaks,
  WAVE_LABELS,
  measure,
  type Drawing,
  type PathDrawing,
  type SpanDrawing,
  type WaveDrawing,
} from "@/lib/charts/drawings";
import {
  channelLines,
  extensionLevels,
  NOTE_FONT_PX,
  timeZoneXs,
  wrapText,
  type Box,
  MARK,
  type Projector,
  type Px,
} from "@/lib/charts/geometry";

export const UP = "#34d399";
export const DOWN = "#fb7185";
export const LABEL_TEXT = "#0a0a0a";
export const PANEL = "#171717";
export const PANEL_EDGE = "#404040";
export const PLAIN = "#e5e5e5";
export const QUIET = "#a3a3a3";
export const HALO = "rgba(10, 10, 10, 0.85)";

export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** What a painter reads from the layer's scene. */
export type Paint = {
  font: string;
  price: (value: number) => string;
  clock: BarClock;
  selected: string | null;
  draft: Drawing | null;
};

export function line(ctx: CanvasRenderingContext2D, a: Px, b: Px) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

export function pill(
  scene: Paint,
  ctx: CanvasRenderingContext2D,
  lines: string[],
  center: Px,
  back: string,
  text: string,
  anchor: "above" | "below" | "middle",
) {
  ctx.font = `500 11px ${scene.font}`;
  const lineHeight = 15;
  const padX = 7;
  const padY = 4;
  const width =
    Math.max(...lines.map((one) => ctx.measureText(one).width)) + padX * 2;
  const height = lines.length * lineHeight + padY * 2 - 2;
  const top =
    anchor === "above"
      ? center.y - height - 6
      : anchor === "below"
        ? center.y + 6
        : center.y - height / 2;
  const left = center.x - width / 2;
  ctx.setLineDash([]);
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.roundRect(left, top, width, height, 4);
  ctx.fill();
  ctx.fillStyle = text;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  lines.forEach((one, i) =>
    ctx.fillText(one, center.x, top + padY + i * lineHeight),
  );
}

/** An open arrowhead at `b`, pointing away from `a`, sized to the line. */
export function head(
  ctx: CanvasRenderingContext2D,
  a: Px,
  b: Px,
  width: number,
) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 1) return;
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  const size = Math.min(length, 8 + width * 2.5);
  const spread = size * 0.55;
  ctx.setLineDash([]);
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(b.x - ux * size - uy * spread, b.y - uy * size + ux * spread);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(b.x - ux * size + uy * spread, b.y - uy * size - ux * spread);
  ctx.stroke();
}

export function pathOf(drawing: Drawing, view: Projector): Px[] {
  return drawing.points
    .map((point) => {
      const x = view.x(point.time);
      const y = view.y(point.price);
      return x === null || y === null ? null : { x, y };
    })
    .filter((one): one is Px => one !== null);
}

/** A note's or callout's box: the text on the panel colour, edged in the drawing's colour. */
export function drawText(
  scene: Paint,
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  box: Box,
  filled: boolean,
) {
  const lines = wrapText(drawing.text ?? "");
  const empty = !drawing.text?.trim();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.width, box.height, 5);
  ctx.fillStyle = filled ? drawing.color : alpha(PANEL, 0.94);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = filled ? alpha(PANEL, 0.6) : alpha(drawing.color, 0.7);
  ctx.stroke();
  ctx.font = `500 ${NOTE_FONT_PX}px ${scene.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = filled ? LABEL_TEXT : drawing.color;
  if (empty) ctx.globalAlpha = 0.6;
  lines.forEach((line, i) =>
    ctx.fillText(line, box.x + 8, box.y + 5 + i * 16, box.width - 12),
  );
  ctx.globalAlpha = 1;
}

/** The base line, its parallel and the band between, with a dashed middle. */
export function drawChannel(
  ctx: CanvasRenderingContext2D,
  drawing: PathDrawing,
  view: Projector,
) {
  const lines = channelLines(drawing.points, view);
  if (!lines) return;
  const { base, parallel } = lines;
  if (drawing.points.length >= 3) {
    ctx.fillStyle = alpha(drawing.color, 0.1);
    ctx.beginPath();
    ctx.moveTo(base[0].x, base[0].y);
    ctx.lineTo(base[1].x, base[1].y);
    ctx.lineTo(parallel[1].x, parallel[1].y);
    ctx.lineTo(parallel[0].x, parallel[0].y);
    ctx.closePath();
    ctx.fill();
    line(ctx, ...parallel);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const mid = (i: 0 | 1) => ({
      x: (base[i].x + parallel[i].x) / 2,
      y: (base[i].y + parallel[i].y) / 2,
    });
    line(ctx, mid(0), mid(1));
    ctx.restore();
  }
  line(ctx, ...base);
}

/** The levels from the pullback's end, labelled at their right, with the move's path dashed. */
export function drawExtension(
  scene: Paint,
  ctx: CanvasRenderingContext2D,
  drawing: PathDrawing,
  view: Projector,
) {
  const path = pathOf(drawing, view);
  ctx.strokeStyle = alpha(QUIET, 0.7);
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  const zone = extensionLevels(drawing.points, view);
  if (!zone) return;
  ctx.setLineDash([]);
  for (let i = 1; i < zone.levels.length; i++) {
    const top = zone.levels[i - 1].y;
    const bottom = zone.levels[i].y;
    if (top === null || bottom === null) continue;
    ctx.fillStyle = alpha(zone.levels[i].color, 0.08);
    ctx.fillRect(
      zone.left,
      Math.min(top, bottom),
      zone.right - zone.left,
      Math.abs(bottom - top),
    );
  }
  ctx.font = `500 11px ${scene.font}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const labelOf = (level: (typeof zone.levels)[number]) =>
    `${level.ratio} (${scene.price(level.price)})`;
  const widest = Math.max(
    ...zone.levels.map((level) => ctx.measureText(labelOf(level)).width),
  );
  // Labels sit right of the levels when they fit, else just inside, above each line.
  const outside = zone.right + 6 + widest <= view.width;
  for (const level of zone.levels) {
    if (level.y === null) continue;
    ctx.strokeStyle = level.color;
    ctx.lineWidth = 1;
    line(ctx, { x: zone.left, y: level.y }, { x: zone.right, y: level.y });
    const label = labelOf(level);
    const x = outside ? zone.right + 6 : zone.left + 6;
    const y = outside ? level.y : level.y - 7;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeStyle = HALO;
    ctx.strokeText(label, x, y);
    ctx.fillStyle = level.color;
    ctx.fillText(label, x, y);
  }
}

/** A vertical line at each Fibonacci count of the first gap, numbered at the foot. */
export function drawTimeZones(
  scene: Paint,
  ctx: CanvasRenderingContext2D,
  drawing: SpanDrawing,
  a: Px,
  b: Px,
  view: Projector,
) {
  for (const x of timeZoneXs(drawing.points, view))
    line(ctx, { x, y: 0 }, { x, y: view.height });
  const { logicalOf, logicalX } = view;
  if (logicalOf && logicalX) {
    const start = logicalOf(drawing.points[0].time);
    const unit = logicalOf(drawing.points[1].time) - start;
    if (Math.abs(unit) >= 0.5) {
      ctx.setLineDash([]);
      ctx.font = `500 11px ${scene.font}`;
      ctx.textAlign = unit > 0 ? "left" : "right";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = drawing.color;
      for (const step of FIB_TIME_STEPS) {
        const x = logicalX(start + unit * step);
        if (x === null || x < 0 || x > view.width) continue;
        ctx.fillText(String(step), x + (unit > 0 ? 4 : -4), view.height - 4);
      }
    }
  }
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  line(ctx, a, b);
  ctx.restore();
}

/** A stroke through the brush's points, smoothed through their midpoints. */
export function drawBrush(
  ctx: CanvasRenderingContext2D,
  drawing: PathDrawing,
  view: Projector,
) {
  const at = pathOf(drawing, view);
  if (at.length < 2) return;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(at[0].x, at[0].y);
  for (let i = 1; i < at.length - 1; i++) {
    const midX = (at[i].x + at[i + 1].x) / 2;
    const midY = (at[i].y + at[i + 1].y) / 2;
    ctx.quadraticCurveTo(at[i].x, at[i].y, midX, midY);
  }
  const last = at[at.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

/** One half of the measure: the move in price, or the span in time. */
export function drawRange(
  scene: Paint,
  ctx: CanvasRenderingContext2D,
  drawing: SpanDrawing,
  a: Px,
  b: Px,
) {
  const { change, changePct, bars, days } = measure(
    drawing.points,
    scene.clock,
  );
  const price = drawing.kind === "priceRange";
  const tone = price && change < 0 ? DOWN : drawing.color;
  const top = Math.min(a.y, b.y);
  ctx.fillStyle = alpha(tone, 0.14);
  ctx.fillRect(
    Math.min(a.x, b.x),
    top,
    Math.abs(b.x - a.x),
    Math.abs(b.y - a.y),
  );
  ctx.strokeStyle = tone;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const head = (tip: Px, dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(tip.x - dx * 6 - dy * 4, tip.y - dy * 6 - dx * 4);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(tip.x - dx * 6 + dy * 4, tip.y - dy * 6 + dx * 4);
    ctx.stroke();
  };
  if (price) {
    line(ctx, { x: a.x, y: a.y }, { x: b.x, y: a.y });
    line(ctx, { x: a.x, y: b.y }, { x: b.x, y: b.y });
    line(ctx, { x: midX, y: a.y }, { x: midX, y: b.y });
    if (Math.abs(b.y - a.y) > 8)
      head({ x: midX, y: b.y }, 0, Math.sign(b.y - a.y));
    pill(
      scene,
      ctx,
      [`${signedFixed(change)} (${signedPct(changePct)})`],
      { x: midX, y: change >= 0 ? top : Math.max(a.y, b.y) },
      tone,
      LABEL_TEXT,
      change >= 0 ? "above" : "below",
    );
    return;
  }
  line(ctx, { x: a.x, y: a.y }, { x: a.x, y: b.y });
  line(ctx, { x: b.x, y: a.y }, { x: b.x, y: b.y });
  line(ctx, { x: a.x, y: midY }, { x: b.x, y: midY });
  if (Math.abs(b.x - a.x) > 8)
    head({ x: b.x, y: midY }, Math.sign(b.x - a.x), 0);
  pill(
    scene,
    ctx,
    [`${Math.abs(bars)} bars, ${Math.abs(days)}d`],
    { x: midX, y: Math.max(a.y, b.y) },
    tone,
    LABEL_TEXT,
    "below",
  );
}

/** A solid arrow whose tip sits on the point: under the bar for up, over it for down. */
export function drawMark(
  ctx: CanvasRenderingContext2D,
  color: string,
  tip: Px,
  up: boolean,
) {
  const sign = up ? 1 : -1;
  const { width, height } = MARK;
  const headDepth = height * 0.5;
  const stem = width * 0.22;
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.strokeStyle = HALO;
  ctx.lineWidth = 1;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x + width / 2, tip.y + sign * headDepth);
  ctx.lineTo(tip.x + stem, tip.y + sign * headDepth);
  ctx.lineTo(tip.x + stem, tip.y + sign * height);
  ctx.lineTo(tip.x - stem, tip.y + sign * height);
  ctx.lineTo(tip.x - stem, tip.y + sign * headDepth);
  ctx.lineTo(tip.x - width / 2, tip.y + sign * headDepth);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * The count's legs joined point to point, each turn labelled in a circle
 * set off the line: above a peak, below a trough. A broken impulse rule is
 * named under the count once it is picked.
 */
export function drawWave(
  scene: Paint,
  ctx: CanvasRenderingContext2D,
  drawing: WaveDrawing,
  view: Projector,
) {
  const at = drawing.points.map((point) => {
    const x = view.x(point.time);
    const y = view.y(point.price);
    return x === null || y === null ? null : { x, y };
  });
  ctx.beginPath();
  let open = false;
  for (const p of at) {
    if (!p) {
      open = false;
      continue;
    }
    if (open) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
    open = true;
  }
  ctx.stroke();

  const labels = WAVE_LABELS[drawing.kind];
  ctx.setLineDash([]);
  ctx.font = `600 11px ${scene.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const radius = 8;
  at.forEach((p, i) => {
    const label = labels[i];
    if (!p || !label) return;
    const before = at[i - 1];
    const after = at[i + 1];
    const near = after ?? before;
    // A turn is a peak when the line comes up into it or leaves it going down.
    const peak = before ? before.y > p.y : near ? near.y > p.y : true;
    const cy = p.y + (peak ? -1 : 1) * (radius + 6);
    ctx.beginPath();
    ctx.arc(p.x, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = alpha(PANEL, 0.92);
    ctx.fill();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = drawing.color;
    ctx.stroke();
    ctx.fillStyle = drawing.color;
    ctx.fillText(label, p.x, cy + 0.5);
  });

  const picked = drawing.id === scene.selected || drawing === scene.draft;
  if (drawing.kind !== "elliottImpulse" || !picked) return;
  const broken = impulseBreaks(drawing.points);
  const end = at[at.length - 1];
  if (!broken.length || !end) return;
  const lowest = Math.max(...at.map((p) => p?.y ?? -Infinity));
  const xs = at.filter((p): p is Px => p !== null).map((p) => p.x);
  // Under the count, kept inside the pane when the count runs off it.
  const edge = 110;
  const middle = Math.min(
    Math.max((Math.min(...xs) + Math.max(...xs)) / 2, edge),
    Math.max(edge, view.width - edge),
  );
  const tall = broken.length * 15 + 6;
  const under = Math.min(lowest + radius * 2 + 6, view.height - tall - 12);
  pill(
    scene,
    ctx,
    broken,
    { x: middle, y: under },
    alpha(DOWN, 0.92),
    LABEL_TEXT,
    "below",
  );
}

export function drawFib(
  scene: Paint,
  ctx: CanvasRenderingContext2D,
  drawing: SpanDrawing,
  a: Px,
  b: Px,
  view: Projector,
) {
  const [from, to] = drawing.points;
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const levels = FIB_LEVELS.map((level) => {
    const price = fibPrice(from, to, level.ratio);
    return { ...level, price, y: view.y(price) };
  });
  for (let i = 1; i < levels.length; i++) {
    const top = levels[i - 1].y;
    const bottom = levels[i].y;
    if (top === null || bottom === null) continue;
    ctx.fillStyle = alpha(levels[i].color, 0.09);
    ctx.fillRect(
      left,
      Math.min(top, bottom),
      right - left,
      Math.abs(bottom - top),
    );
  }
  ctx.font = `500 11px ${scene.font}`;
  ctx.textBaseline = "middle";
  const labelOf = (level: (typeof levels)[number]) =>
    `${level.ratio} (${scene.price(level.price)})`;
  const widest = Math.max(
    ...levels.map((level) => ctx.measureText(labelOf(level)).width),
  );
  const outside = widest + 8 <= left;
  for (const level of levels) {
    if (level.y === null) continue;
    ctx.strokeStyle = level.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    line(ctx, { x: left, y: level.y }, { x: right, y: level.y });
    const label = labelOf(level);
    ctx.textAlign = outside ? "right" : "left";
    const x = outside ? left - 6 : left + 6;
    const y = outside ? level.y : level.y - 7;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeStyle = HALO;
    ctx.strokeText(label, x, y);
    ctx.fillStyle = level.color;
    ctx.fillText(label, x, y);
  }
  ctx.strokeStyle = alpha(QUIET, 0.7);
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  line(ctx, a, b);
}

export function drawMeasure(
  scene: Paint,
  ctx: CanvasRenderingContext2D,
  drawing: SpanDrawing,
  a: Px,
  b: Px,
) {
  const { change, changePct, bars, days } = measure(
    drawing.points as [SpanDrawing["points"][0], SpanDrawing["points"][1]],
    scene.clock,
  );
  const tone = change >= 0 ? "#38bdf8" : DOWN;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  ctx.fillStyle = alpha(tone, 0.16);
  ctx.fillRect(x, y, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  ctx.strokeStyle = tone;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  line(ctx, { x: midX, y: a.y }, { x: midX, y: b.y });
  line(ctx, { x: a.x, y: midY }, { x: b.x, y: midY });
  const head = (tip: Px, dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(tip.x - dx * 6 - dy * 4, tip.y - dy * 6 - dx * 4);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(tip.x - dx * 6 + dy * 4, tip.y - dy * 6 + dx * 4);
    ctx.stroke();
  };
  if (Math.abs(b.y - a.y) > 8)
    head({ x: midX, y: b.y }, 0, Math.sign(b.y - a.y));
  if (Math.abs(b.x - a.x) > 8)
    head({ x: b.x, y: midY }, Math.sign(b.x - a.x), 0);
  const lines = [
    `${signedFixed(change)} (${signedPct(changePct)})`,
    `${bars} bars, ${days}d`,
  ];
  pill(
    scene,
    ctx,
    lines,
    { x: midX, y: change >= 0 ? Math.min(a.y, b.y) : Math.max(a.y, b.y) },
    tone,
    LABEL_TEXT,
    change >= 0 ? "above" : "below",
  );
}
