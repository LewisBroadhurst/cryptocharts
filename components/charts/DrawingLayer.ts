import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  ISeriesPrimitiveAxisView,
  Logical,
  PrimitiveHoveredItem,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";

import { BarClock } from "@/lib/charts/bars";
import { chartStamp } from "@/lib/dates";
import { pct, signedPct } from "@/lib/format";
import {
  isPosition,
  positionOutcome,
  positionStats,
  type Drawing,
  type LineStyle,
  type PositionDrawing,
  type SpanDrawing,
} from "@/lib/charts/drawings";
import {
  extendLine,
  textBox,
  handles,
  hitTest,
  pointIndex,
  type HitPart,
  type Projector,
  type Px,
} from "@/lib/charts/geometry";
import type { Candle } from "@/lib/data/chart-data";
import {
  alpha,
  DOWN,
  drawExtension,
  drawFib,
  drawBrush,
  drawChannel,
  drawMark,
  drawMeasure,
  drawRange,
  drawText,
  drawTimeZones,
  drawWave,
  head,
  LABEL_TEXT,
  line,
  PANEL,
  PANEL_EDGE,
  pill,
  PLAIN,
  UP,
} from "@/components/charts/drawingPainters";

type CanvasRenderingTarget2D = Parameters<IPrimitivePaneRenderer["draw"]>[0];

const DASHES: Record<LineStyle, number[]> = {
  solid: [],
  dashed: [6, 4],
  dotted: [1.5, 3],
};

const CURSORS: Record<Exclude<HitPart, `p${number}`>, string> = {
  cornerA: "nwse-resize",
  cornerB: "nesw-resize",
  target: "ns-resize",
  stop: "ns-resize",
  end: "ew-resize",
  body: "move",
};

type Scene = {
  drawings: readonly Drawing[];
  draft: Drawing | null;
  selected: string | null;
  hovered: string | null;
  candles: readonly Candle[];
  clock: BarClock;
  font: string;
  price: (value: number) => string;
};

class AxisLabel implements ISeriesPrimitiveAxisView {
  constructor(
    private readonly at: number,
    private readonly label: string,
    private readonly back: string,
  ) {}
  coordinate() {
    return this.at;
  }
  text() {
    return this.label;
  }
  textColor() {
    return LABEL_TEXT;
  }
  backColor() {
    return this.back;
  }
}

export class DrawingLayer implements ISeriesPrimitive<Time> {
  private param: SeriesAttachedParameter<Time> | null = null;
  private scene: Scene = {
    drawings: [],
    draft: null,
    selected: null,
    hovered: null,
    candles: [],
    clock: new BarClock([]),
    font: "system-ui, sans-serif",
    price: (value) => value.toFixed(2),
  };
  private priceViews: ISeriesPrimitiveAxisView[] = [];
  private timeViews: ISeriesPrimitiveAxisView[] = [];
  private readonly views: readonly IPrimitivePaneView[];

  constructor() {
    const renderer: IPrimitivePaneRenderer = {
      draw: (target) => this.draw(target),
    };
    this.views = [{ zOrder: () => "top", renderer: () => renderer }];
  }

  attached(param: SeriesAttachedParameter<Time>) {
    this.param = param;
  }

  detached() {
    this.param = null;
  }

  set(next: Partial<Scene>) {
    this.scene = { ...this.scene, ...next };
    this.updateAllViews();
    this.param?.requestUpdate();
  }

  get state(): Readonly<Scene> {
    return this.scene;
  }

  projector(): Projector | null {
    const param = this.param;
    if (!param) return null;
    const { chart, series } = param;
    const size = chart.paneSize(0);
    const scale = chart.timeScale();
    const { clock } = this.scene;
    // The chart places only whole bars, so a moment between two (a daily
    // drawing on a monthly chart) is placed between their coordinates.
    const x = (time: number) => {
      const logical = clock.logicalOf(time);
      const whole = Math.floor(logical);
      const left = scale.logicalToCoordinate(whole as Logical);
      if (left === null || logical === whole) return left;
      const right = scale.logicalToCoordinate((whole + 1) as Logical);
      return right === null ? null : left + (logical - whole) * (right - left);
    };
    const logicalX = (logical: number) => {
      const whole = Math.floor(logical);
      const left = scale.logicalToCoordinate(whole as Logical);
      if (left === null || logical === whole) return left;
      const right = scale.logicalToCoordinate((whole + 1) as Logical);
      return right === null ? null : left + (logical - whole) * (right - left);
    };
    return {
      x,
      y: (price) => series.priceToCoordinate(price),
      width: size.width,
      height: size.height,
      logicalX,
      logicalOf: (time) => clock.logicalOf(time),
    };
  }

  paneViews() {
    return this.views;
  }

  priceAxisViews() {
    return this.priceViews;
  }

  timeAxisViews() {
    return this.timeViews;
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const view = this.projector();
    if (!view) return null;
    const hit = hitTest(this.scene.drawings, { x, y }, view, {
      selected: this.scene.selected,
    });
    if (!hit) return null;
    const drawing = this.scene.drawings.find((one) => one.id === hit.id);
    return {
      externalId: hit.id,
      zOrder: "top",
      distance: hit.distance,
      cursorStyle: drawing?.locked
        ? "pointer"
        : pointIndex(hit.part) !== null
          ? "grab"
          : CURSORS[hit.part as keyof typeof CURSORS],
    };
  }

  updateAllViews() {
    const view = this.projector();
    const prices: ISeriesPrimitiveAxisView[] = [];
    const times: ISeriesPrimitiveAxisView[] = [];
    if (view) {
      const { drawings, draft, selected, price } = this.scene;
      const tag = (value: number, color: string) => {
        const y = view.y(value);
        if (y !== null) prices.push(new AxisLabel(y, price(value), color));
      };
      const stamp = (time: number, color: string) => {
        const x = view.x(time);
        if (x !== null)
          times.push(new AxisLabel(x, chartStamp(time), color));
      };
      for (const drawing of [...drawings, ...(draft ? [draft] : [])]) {
        if (drawing.hidden) continue;
        const picked = drawing.id === selected || drawing === draft;
        if (drawing.kind === "horizontal" || drawing.kind === "horizontalRay")
          tag(drawing.points[0].price, drawing.color);
        if (drawing.kind === "vertical" && picked)
          stamp(drawing.points[0].time, drawing.color);
        if (!picked) continue;
        if (isPosition(drawing)) {
          tag(drawing.target, UP);
          tag(drawing.points[0].price, PLAIN);
          tag(drawing.stop, DOWN);
          stamp(drawing.points[0].time, PLAIN);
          stamp(drawing.points[1].time, PLAIN);
        } else if (drawing.kind === "brush") {
          continue;
        } else if (drawing.points.length >= 2) {
          for (const point of drawing.points) {
            tag(point.price, drawing.color);
            stamp(point.time, drawing.color);
          }
        }
      }
    }
    this.priceViews = prices;
    this.timeViews = times;
  }

  private draw(target: CanvasRenderingTarget2D) {
    const view = this.projector();
    if (!view) return;
    target.useMediaCoordinateSpace(({ context }) => {
      const ctx = context;
      const { drawings, draft, selected, hovered } = this.scene;
      for (const drawing of drawings) {
        if (drawing.hidden) continue;
        this.drawOne(ctx, drawing, view);
      }
      if (draft) this.drawOne(ctx, draft, view);
      const picked = draft ?? drawings.find((one) => one.id === selected);
      const lit = drawings.find((one) => one.id === hovered);
      if (lit && lit !== picked && !lit.hidden)
        this.drawHandles(ctx, lit, view, true);
      if (picked && !picked.hidden) this.drawHandles(ctx, picked, view, false);
    });
  }

  private stroke(
    ctx: CanvasRenderingContext2D,
    drawing: Pick<Drawing, "color" | "width" | "style">,
  ) {
    ctx.strokeStyle = drawing.color;
    ctx.lineWidth = drawing.width;
    ctx.setLineDash(DASHES[drawing.style]);
    ctx.lineCap = "round";
  }

  private drawOne(
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    view: Projector,
  ) {
    const x0 = view.x(drawing.points[0].time);
    const y0 = view.y(drawing.points[0].price);
    if (x0 === null || y0 === null) return;
    const a = { x: x0, y: y0 };
    ctx.save();
    this.stroke(ctx, drawing);
    switch (drawing.kind) {
      case "horizontal":
        line(ctx, { x: 0, y: a.y }, { x: view.width, y: a.y });
        break;
      case "horizontalRay":
        line(ctx, a, { x: view.width, y: a.y });
        break;
      case "vertical":
        line(ctx, { x: a.x, y: 0 }, { x: a.x, y: view.height });
        break;
      case "arrowUp":
      case "arrowDown":
        drawMark(ctx, drawing.color, a, drawing.kind === "arrowUp");
        break;
      case "elliottImpulse":
      case "elliottCorrection":
      case "elliottTriangle":
      case "elliottCombo":
        drawWave(this.scene, ctx, drawing, view);
        break;
      case "note":
        drawText(
          this.scene,
          ctx,
          drawing,
          textBox(drawing.text, a, false),
          false,
        );
        break;
      case "channel":
        drawChannel(ctx, drawing, view);
        break;
      case "fibExtension":
        drawExtension(this.scene, ctx, drawing, view);
        break;
      case "brush":
        drawBrush(ctx, drawing, view);
        break;
      default: {
        const second = drawing.points[1]!;
        const x1 = view.x(second.time);
        const y1 = view.y(second.price);
        if (x1 === null || y1 === null) break;
        const b = { x: x1, y: y1 };
        if (isPosition(drawing)) this.drawPosition(ctx, drawing, a, b, view);
        else this.drawSpan(ctx, drawing as SpanDrawing, a, b, view);
      }
    }
    ctx.restore();
  }

  private drawSpan(
    ctx: CanvasRenderingContext2D,
    drawing: SpanDrawing,
    a: Px,
    b: Px,
    view: Projector,
  ) {
    switch (drawing.kind) {
      case "trend":
        line(ctx, a, b);
        return;
      case "arrow":
        line(ctx, a, b);
        head(ctx, a, b, drawing.width);
        return;
      case "callout": {
        line(ctx, a, b);
        ctx.setLineDash([]);
        ctx.fillStyle = drawing.color;
        ctx.beginPath();
        ctx.arc(a.x, a.y, 2.5 + drawing.width / 2, 0, Math.PI * 2);
        ctx.fill();
        drawText(
          this.scene,
          ctx,
          drawing,
          textBox(drawing.text, b, true),
          true,
        );
        return;
      }
      case "fibTimeZone":
        drawTimeZones(this.scene, ctx, drawing, a, b, view);
        return;
      case "priceRange":
      case "dateRange":
        drawRange(this.scene, ctx, drawing, a, b);
        return;
      case "ray":
      case "extended": {
        const [from, to] = extendLine(
          a,
          b,
          view.width,
          view.height,
          drawing.kind === "extended",
        );
        line(ctx, from, to);
        return;
      }
      case "rectangle": {
        ctx.fillStyle = alpha(drawing.color, 0.14);
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const w = Math.abs(b.x - a.x);
        const h = Math.abs(b.y - a.y);
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        return;
      }
      case "fib":
        drawFib(this.scene, ctx, drawing, a, b, view);
        return;
      case "measure":
        drawMeasure(this.scene, ctx, drawing, a, b);
        return;
    }
  }

  private drawPosition(
    ctx: CanvasRenderingContext2D,
    position: PositionDrawing,
    a: Px,
    b: Px,
    view: Projector,
  ) {
    const target = view.y(position.target);
    const stop = view.y(position.stop);
    if (target === null || stop === null) return;
    const left = Math.min(a.x, b.x);
    const width = Math.max(1, Math.abs(b.x - a.x));
    ctx.setLineDash([]);
    ctx.fillStyle = alpha(UP, 0.18);
    ctx.fillRect(left, Math.min(a.y, target), width, Math.abs(target - a.y));
    ctx.fillStyle = alpha(DOWN, 0.18);
    ctx.fillRect(left, Math.min(a.y, stop), width, Math.abs(stop - a.y));

    const outcome = positionOutcome(position, this.scene.candles);
    if (outcome.exit) {
      const ex = view.x(outcome.exit.time);
      const ey = view.y(outcome.exit.price);
      if (ex !== null && ey !== null) {
        const won = outcome.pnlPct >= 0;
        ctx.fillStyle = alpha(won ? UP : DOWN, 0.22);
        ctx.fillRect(
          left,
          Math.min(a.y, ey),
          Math.max(0, ex - left),
          Math.abs(ey - a.y),
        );
        ctx.strokeStyle = PLAIN;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        line(ctx, a, { x: ex, y: ey });
        ctx.setLineDash([]);
        ctx.fillStyle = PLAIN;
        ctx.beginPath();
        ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.strokeStyle = alpha(PLAIN, 0.8);
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    line(ctx, { x: left, y: a.y }, { x: left + width, y: a.y });

    const stats = positionStats(position);
    const { price } = this.scene;
    const middle = left + width / 2;
    const up = target < stop;
    pill(
      this.scene,
      ctx,
      [`Target ${price(position.target)} (${pct(stats.rewardPct, 2)})`],
      { x: middle, y: target },
      UP,
      LABEL_TEXT,
      up ? "above" : "below",
    );
    pill(
      this.scene,
      ctx,
      [`Stop ${price(position.stop)} (${pct(stats.riskPct, 2)})`],
      { x: middle, y: stop },
      DOWN,
      LABEL_TEXT,
      up ? "below" : "above",
    );
    const state =
      outcome.state === "target"
        ? "Target hit"
        : outcome.state === "stop"
          ? "Stopped out"
          : outcome.state === "open"
            ? "Open"
            : "Not started";
    const result =
      outcome.state === "waiting"
        ? state
        : `${state} ${signedPct(outcome.pnlPct)}`;
    pill(
      this.scene,
      ctx,
      [result, `Risk/reward ${stats.ratio.toFixed(2)}`],
      { x: middle, y: a.y },
      alpha(PANEL, 0.92),
      PLAIN,
      "middle",
    );
  }

  private drawHandles(
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    view: Projector,
    faint: boolean,
  ) {
    ctx.save();
    ctx.setLineDash([]);
    for (const { at } of handles(drawing, view)) {
      ctx.beginPath();
      ctx.arc(at.x, at.y, faint ? 3.5 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = faint ? alpha(PANEL, 0.9) : PANEL;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = drawing.locked
        ? PANEL_EDGE
        : isPosition(drawing)
          ? PLAIN
          : drawing.color;
      ctx.stroke();
    }
    ctx.restore();
  }
}
