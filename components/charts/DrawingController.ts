import type { IChartApi, ISeriesApi, SeriesType } from "lightweight-charts";

import { BarClock } from "@/lib/charts/bars";
import {
  defaultBracket,
  drawingId,
  hasText,
  MAX_BRUSH_POINTS,
  KIND_COLOR,
  ONE_POINT,
  pointCount,
  settleBracket,
  shiftDrawing,
  DEFAULT_DRAWING_COLOR,
  type Anchor,
  type Drawing,
  type DrawingKind,
  type PositionDrawing,
} from "@/lib/charts/drawings";
import {
  hitTest,
  pointIndex,
  type HitPart,
  type Px,
} from "@/lib/charts/geometry";
import type { Candle } from "@/lib/data/chart-data";
import type { DrawingLayer } from "@/components/charts/DrawingLayer";

const MAGNET_PX = 28;
const DRAG_PX = 5;
/** How far the pointer moves before a brush stroke takes another point. */
const BRUSH_STEP_PX = 3;

export type ControllerEvents = {
  commit: (drawings: Drawing[]) => void;
  select: (id: string | null) => void;
  /** A drawing was finished, so the tool is done. */
  toolDone: (drawing: Drawing) => void;
};

type Drag = {
  id: string;
  part: HitPart;
  start: Anchor;
  startLogical: number;
  original: Drawing;
  moved: boolean;
};

type Placing = {
  kind: DrawingKind;
  press: Px;
  waiting: boolean;
};

export class DrawingController {
  private drawings: Drawing[] = [];
  private tool: DrawingKind | null = null;
  private placing: Placing | null = null;
  private drag: Drag | null = null;
  private selected: string | null = null;
  private candles: readonly Candle[] = [];
  private clock = new BarClock([]);
  private magnet = true;
  private locked = false;
  private hidden = false;
  private paused = false;
  private series: ISeriesApi<SeriesType> | null = null;

  constructor(
    private readonly chart: IChartApi,
    private readonly element: HTMLElement,
    private readonly layer: DrawingLayer,
    private readonly events: ControllerEvents,
    private readonly style: { color: () => string | null },
  ) {
    element.addEventListener("pointerdown", this.onDown, true);
    element.addEventListener("pointermove", this.onMove);
    element.addEventListener("pointerup", this.onUp);
    element.addEventListener("pointercancel", this.onCancel);
    element.addEventListener("pointerleave", this.onLeave);
  }

  destroy() {
    this.element.removeEventListener("pointerdown", this.onDown, true);
    this.element.removeEventListener("pointermove", this.onMove);
    this.element.removeEventListener("pointerup", this.onUp);
    this.element.removeEventListener("pointercancel", this.onCancel);
    this.element.removeEventListener("pointerleave", this.onLeave);
  }

  setSeries(series: ISeriesApi<SeriesType>) {
    this.series = series;
  }

  setData(candles: readonly Candle[], clock: BarClock) {
    this.candles = candles;
    this.clock = clock;
  }

  setDrawings(drawings: Drawing[]) {
    if (this.drag) return;
    this.drawings = drawings;
    this.show();
  }

  setHidden(on: boolean) {
    this.hidden = on;
    this.show();
  }

  private get shown(): Drawing[] {
    return this.hidden ? [] : this.drawings;
  }

  private show() {
    this.layer.set({ drawings: this.shown });
  }

  setSelected(id: string | null) {
    this.selected = id;
    this.layer.set({ selected: id });
  }

  setMagnet(on: boolean) {
    this.magnet = on;
  }

  setLocked(on: boolean) {
    this.locked = on;
  }

  setTool(tool: DrawingKind | null) {
    this.tool = tool;
    this.cancelPlacing();
  }

  cancelPlacing(): boolean {
    const had = this.placing !== null;
    this.placing = null;
    this.layer.set({ draft: null });
    this.resume();
    return had;
  }

  private local(event: PointerEvent): Px {
    const box = this.element.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  private inPane(p: Px): boolean {
    const size = this.chart.paneSize(0);
    return p.x >= 0 && p.y >= 0 && p.x <= size.width && p.y <= size.height;
  }

  private logicalAt(x: number): number | null {
    const logical = this.chart.timeScale().coordinateToLogical(x);
    return logical === null ? null : Math.round(logical);
  }

  private anchorAt(p: Px, magnet = this.magnet): Anchor | null {
    const series = this.series;
    if (!series) return null;
    const logical = this.logicalAt(p.x);
    const price = series.coordinateToPrice(p.y);
    if (logical === null || price === null) return null;
    const anchor = { time: this.clock.timeOf(logical), price };
    if (!magnet) return anchor;
    const index = this.clock.barIndex(logical);
    const bar = index === null ? null : this.candles[index];
    if (!bar) return anchor;
    let best: { price: number; gap: number } | null = null;
    for (const value of [bar.open, bar.high, bar.low, bar.close]) {
      const y = series.priceToCoordinate(value);
      if (y === null) continue;
      const gap = Math.abs(y - p.y);
      if (gap <= MAGNET_PX && (!best || gap < best.gap))
        best = { price: value, gap };
    }
    return best ? { ...anchor, price: best.price } : anchor;
  }

  private priceAt(y: number): number | null {
    return this.series?.coordinateToPrice(y) ?? null;
  }

  private pause() {
    if (this.paused) return;
    this.paused = true;
    this.chart.applyOptions({ handleScroll: false, handleScale: false });
  }

  private resume() {
    if (!this.paused) return;
    this.paused = false;
    this.chart.applyOptions({ handleScroll: true, handleScale: true });
  }

  private newDrawing(kind: DrawingKind, at: Anchor): Drawing {
    const color =
      KIND_COLOR[kind] ?? this.style.color() ?? DEFAULT_DRAWING_COLOR;
    const common = {
      id: drawingId(),
      color,
      width: 2 as const,
      style: "solid" as const,
      ...(hasText(kind) && { text: "" }),
    };
    if (ONE_POINT.has(kind))
      return {
        ...common,
        ...(KIND_COLOR[kind] && { color: KIND_COLOR[kind] }),
        kind,
        points: [at],
      } as Drawing;
    if (kind === "long" || kind === "short") {
      const range = this.visiblePriceRange();
      const span = Math.max(8, Math.round(this.visibleBars() * 0.18));
      const end = this.clock.timeOf(this.clock.logicalOf(at.time) + span);
      return {
        ...common,
        color: KIND_COLOR[kind]!,
        width: 1,
        kind,
        points: [at, { time: end, price: at.price }],
        ...defaultBracket(kind, at.price, range),
      };
    }
    return { ...common, kind, points: [at, at] } as Drawing;
  }

  private visibleBars(): number {
    const range = this.chart.timeScale().getVisibleLogicalRange();
    return range ? range.to - range.from : 100;
  }

  private visiblePriceRange(): number {
    const size = this.chart.paneSize(0);
    const top = this.priceAt(0);
    const bottom = this.priceAt(size.height);
    return top !== null && bottom !== null ? Math.abs(top - bottom) : 0;
  }

  private finish(drawing: Drawing) {
    this.placing = null;
    this.layer.set({ draft: null });
    const drawings = [...this.drawings, drawing];
    this.drawings = drawings;
    this.show();
    this.resume();
    this.events.commit(drawings);
    this.events.select(drawing.id);
    this.events.toolDone(drawing);
  }

  private readonly onDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const p = this.local(event);
    if (!this.inPane(p)) return;

    if (this.tool) {
      event.preventDefault();
      const at = this.anchorAt(p);
      if (!at) return;
      this.pause();
      const draft = this.layer.state.draft;
      if (this.placing?.waiting && draft) {
        const placed = this.withEnd(draft, at, event.shiftKey);
        if (placed.points.length >= pointCount(placed.kind)) {
          this.finish(placed);
          return;
        }
        // A wave count takes its next point: the one just placed stays, and
        // a new one follows the pointer.
        this.layer.set({
          draft: { ...placed, points: [...placed.points, at] } as Drawing,
        });
        this.placing = { ...this.placing, press: p };
        return;
      }
      if (this.tool === "brush") {
        const start = this.anchorAt(p, false) ?? at;
        this.placing = { kind: "brush", press: p, waiting: false };
        this.layer.set({ draft: this.newDrawing("brush", start) });
        this.capture(event);
        return;
      }
      const drawing = this.newDrawing(this.tool, at);
      if (
        ONE_POINT.has(this.tool) ||
        this.tool === "long" ||
        this.tool === "short"
      ) {
        this.finish(drawing);
        return;
      }
      this.placing = { kind: this.tool, press: p, waiting: false };
      this.layer.set({ draft: drawing });
      this.capture(event);
      return;
    }

    const view = this.layer.projector();
    if (!view) return;
    const hit = hitTest(this.shown, p, view, {
      selected: this.selected,
      tolerance: event.pointerType === "mouse" ? 6 : 12,
    });
    if (!hit) {
      if (this.selected) this.events.select(null);
      return;
    }
    if (hit.id !== this.selected) this.events.select(hit.id);
    const drawing = this.drawings.find((one) => one.id === hit.id);
    if (!drawing || drawing.locked || this.locked) return;
    const start = this.anchorAt(p, false);
    const startLogical = this.chart.timeScale().coordinateToLogical(p.x);
    if (!start || startLogical === null) return;
    event.preventDefault();
    this.pause();
    this.drag = {
      id: hit.id,
      part: hit.part,
      start,
      startLogical,
      original: drawing,
      moved: false,
    };
    this.capture(event);
  };

  private capture(event: PointerEvent) {
    try {
      this.element.setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser no longer tracks: the drag still works inside the pane.
    }
  }

  /** The draft with its last point moved to `at`; Shift keeps it level with the one before. */
  private withEnd(draft: Drawing, at: Anchor, level: boolean): Drawing {
    if (draft.points.length < 2) return draft;
    const points = [...draft.points];
    const before = points[points.length - 2];
    points[points.length - 1] = level ? { ...at, price: before.price } : at;
    return { ...draft, points } as Drawing;
  }

  private readonly onMove = (event: PointerEvent) => {
    const p = this.local(event);
    if (this.placing?.kind === "brush") {
      const draft = this.layer.state.draft;
      const press = this.placing.press;
      if (!draft || Math.hypot(p.x - press.x, p.y - press.y) < BRUSH_STEP_PX)
        return;
      if (draft.points.length >= MAX_BRUSH_POINTS) return;
      const at = this.anchorAt(p, false);
      if (!at) return;
      this.placing = { ...this.placing, press: p };
      this.layer.set({
        draft: { ...draft, points: [...draft.points, at] } as Drawing,
      });
      return;
    }
    if (this.placing) {
      const draft = this.layer.state.draft;
      const at = this.anchorAt(p);
      if (!draft || !at) return;
      this.layer.set({ draft: this.withEnd(draft, at, event.shiftKey) });
      return;
    }
    if (this.drag) {
      this.dragTo(p, event.shiftKey);
      return;
    }
    if (event.pointerType !== "mouse" || this.tool) return;
    const view = this.layer.projector();
    if (!view) return;
    const hovered =
      hitTest(this.shown, p, view, { selected: this.selected })?.id ?? null;
    if (hovered !== this.layer.state.hovered) this.layer.set({ hovered });
  };

  private dragTo(p: Px, shift: boolean) {
    const drag = this.drag!;
    const original = drag.original;
    let next: Drawing | null = null;
    const at = this.anchorAt(p, drag.part === "body" ? false : this.magnet);
    if (!at) return;
    switch (drag.part) {
      case "body": {
        const nowLogical = this.chart.timeScale().coordinateToLogical(p.x);
        if (nowLogical === null) return;
        const steps = Math.round(nowLogical - drag.startLogical);
        const priceStep = at.price - drag.start.price;
        next = shiftDrawing(original, (anchor) => ({
          time: this.clock.timeOf(this.clock.logicalOf(anchor.time) + steps),
          price:
            original.kind === "vertical"
              ? anchor.price
              : anchor.price + priceStep,
        }));
        break;
      }
      default: {
        const index = pointIndex(drag.part);
        if (index === null) return;
        const points = [...original.points] as Anchor[];
        let point = at;
        if (original.kind === "horizontal" || original.kind === "horizontalRay")
          point =
            original.kind === "horizontal"
              ? { ...points[0], price: at.price }
              : at;
        if (original.kind === "vertical")
          point = { ...points[0], time: at.time };
        if (shift && points.length === 2)
          point = { ...point, price: points[1 - index].price };
        if (shift && points.length > 2) {
          const other = points[index - 1] ?? points[index + 1];
          if (other) point = { ...point, price: other.price };
        }
        points[index] = point;
        next = { ...original, points } as Drawing;
        if (original.kind === "long" || original.kind === "short") {
          const position = next as PositionDrawing;
          const end = position.points[1];
          const minEnd = this.clock.timeOf(
            this.clock.logicalOf(point.time) + 1,
          );
          next = settleBracket({
            ...position,
            points: [point, end.time < minEnd ? { ...end, time: minEnd } : end],
          });
        }
        break;
      }
      case "cornerA":
      case "cornerB": {
        const [a, b] = original.points as [Anchor, Anchor];
        const points: [Anchor, Anchor] =
          drag.part === "cornerA"
            ? [
                { ...a, time: at.time },
                { ...b, price: at.price },
              ]
            : [
                { ...a, price: at.price },
                { ...b, time: at.time },
              ];
        next = { ...original, points } as Drawing;
        break;
      }
      case "target":
      case "stop": {
        const price = this.priceAt(p.y);
        if (price === null) return;
        next = settleBracket({
          ...(original as PositionDrawing),
          [drag.part]: price,
        });
        break;
      }
      case "end": {
        const position = original as PositionDrawing;
        const entry = position.points[0];
        const minEnd = this.clock.timeOf(this.clock.logicalOf(entry.time) + 1);
        next = {
          ...position,
          points: [
            entry,
            { ...position.points[1], time: Math.max(minEnd, at.time) },
          ],
        };
        break;
      }
    }
    if (!next) return;
    drag.moved = true;
    this.drawings = this.drawings.map((one) =>
      one.id === drag.id ? next! : one,
    );
    this.show();
  }

  private readonly onUp = (event: PointerEvent) => {
    if (this.placing?.kind === "brush") {
      const draft = this.layer.state.draft;
      // A tap lays no stroke: it has only its start, twice.
      const [first, second] = draft?.points ?? [];
      if (draft && draft.points.length > 2) this.finish(draft);
      else if (draft && first && second && first.time !== second.time)
        this.finish(draft);
      else this.cancelPlacing();
      return;
    }
    if (this.placing) {
      const p = this.local(event);
      const press = this.placing.press;
      const draft = this.layer.state.draft;
      if (!draft) return;
      const dragged = Math.hypot(p.x - press.x, p.y - press.y) > DRAG_PX;
      if (dragged && draft.points.length >= pointCount(draft.kind)) {
        this.finish(draft);
      } else if (dragged) {
        // A drag lays the first leg of a drawing of three or more points; clicks lay the rest.
        const at = this.anchorAt(p);
        if (at)
          this.layer.set({
            draft: { ...draft, points: [...draft.points, at] } as Drawing,
          });
        this.placing = { ...this.placing, press: p, waiting: true };
      } else {
        this.placing = { ...this.placing, waiting: true };
      }
      return;
    }
    if (this.drag) {
      const { moved } = this.drag;
      this.drag = null;
      this.resume();
      if (moved) this.events.commit(this.drawings);
    }
  };

  private readonly onCancel = () => {
    if (this.drag) {
      const original = this.drag.original;
      this.drawings = this.drawings.map((one) =>
        one.id === original.id ? original : one,
      );
      this.show();
      this.drag = null;
    }
    this.cancelPlacing();
  };

  private readonly onLeave = () => {
    if (this.layer.state.hovered) this.layer.set({ hovered: null });
  };
}
