import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";

import type { LinePoint } from "@/lib/data/chart-data";

type Band = { time: number; upper: number; lower: number };

/** A faint fill between two lines of one series' scale: Bollinger's bands. */
export class BandFill implements ISeriesPrimitive<Time> {
  private param: SeriesAttachedParameter<Time> | null = null;
  private band: Band[] = [];
  private color = "transparent";
  private readonly views: readonly IPrimitivePaneView[];

  constructor() {
    const renderer: IPrimitivePaneRenderer = {
      draw: () => {},
      drawBackground: (target) =>
        target.useMediaCoordinateSpace(({ context }) => this.draw(context)),
    };
    this.views = [{ zOrder: () => "bottom", renderer: () => renderer }];
  }

  attached(param: SeriesAttachedParameter<Time>) {
    this.param = param;
  }

  detached() {
    this.param = null;
  }

  set(upper: readonly LinePoint[], lower: readonly LinePoint[], color: string) {
    this.band = upper.map((point, i) => ({
      time: point.time,
      upper: point.value,
      lower: lower[i]?.value ?? point.value,
    }));
    this.color = color;
    this.param?.requestUpdate();
  }

  paneViews() {
    return this.views;
  }

  private draw(context: CanvasRenderingContext2D) {
    const param = this.param;
    if (!param || this.band.length < 2) return;
    const scale = param.chart.timeScale();
    const { series } = param;
    const top: [number, number][] = [];
    const bottom: [number, number][] = [];
    for (const point of this.band) {
      const x = scale.timeToCoordinate(point.time as Time);
      const high = series.priceToCoordinate(point.upper);
      const low = series.priceToCoordinate(point.lower);
      if (x === null || high === null || low === null) continue;
      top.push([x, high]);
      bottom.push([x, low]);
    }
    if (top.length < 2) return;
    context.beginPath();
    context.moveTo(top[0][0], top[0][1]);
    for (const [x, y] of top) context.lineTo(x, y);
    for (let i = bottom.length - 1; i >= 0; i--)
      context.lineTo(bottom[i][0], bottom[i][1]);
    context.closePath();
    context.fillStyle = this.color;
    context.fill();
  }
}
