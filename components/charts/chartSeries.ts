import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
} from "lightweight-charts";

import type { ChartStyle } from "@/lib/charts/chart-storage";
import type { Study } from "@/lib/charts/studies";
import type { Candle } from "@/lib/data/chart-data";
import { BandFill } from "@/components/charts/BandFill";

const UP = "#34d399";
const DOWN = "#fb7185";
const LINE = "#38bdf8";

export type StudySeries = {
  /** In the order `studyOutputs` gives the study's lines. */
  lines: ISeriesApi<"Line" | "Histogram">[];
  pane: number;
  band?: BandFill;
};

export const hexAlpha = (hex: string, alpha: number) => {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export function addStudySeries(
  chart: IChartApi,
  study: Study,
  pane: number,
): StudySeries {
  const line = (extra: Parameters<typeof chart.addSeries<"Line">>[1] = {}) =>
    chart.addSeries(
      LineSeries,
      { priceLineVisible: false, crosshairMarkerVisible: false, ...extra },
      pane,
    );
  switch (study.kind) {
    case "ema":
    case "sma":
    case "rsi":
      return { lines: [line()], pane };
    case "bb": {
      const middle = line({ lineStyle: LineStyle.Dashed });
      const band = new BandFill();
      middle.attachPrimitive(band);
      return {
        lines: [
          middle,
          line({ lastValueVisible: false }),
          line({ lastValueVisible: false }),
        ],
        pane,
        band,
      };
    }
    case "macd": {
      const histogram = chart.addSeries(
        HistogramSeries,
        { priceLineVisible: false, lastValueVisible: false },
        pane,
      );
      return { lines: [line(), line(), histogram], pane };
    }
  }
}

export function precisionFor(price: number): number {
  const size = Math.abs(price);
  return size < 1 ? 4 : size < 10 ? 3 : 2;
}

export function addMain(
  chart: IChartApi,
  style: ChartStyle,
): ISeriesApi<SeriesType> {
  const shared = {
    priceLineStyle: LineStyle.Dashed,
    priceLineWidth: 1 as const,
  };
  switch (style) {
    case "candles":
      return chart.addSeries(CandlestickSeries, {
        ...shared,
        upColor: UP,
        downColor: DOWN,
        borderUpColor: UP,
        borderDownColor: DOWN,
        wickUpColor: UP,
        wickDownColor: DOWN,
      });
    case "bars":
      return chart.addSeries(BarSeries, {
        ...shared,
        upColor: UP,
        downColor: DOWN,
        thinBars: false,
      });
    case "line":
      return chart.addSeries(LineSeries, {
        ...shared,
        color: LINE,
        lineWidth: 2,
      });
    case "area":
      return chart.addSeries(AreaSeries, {
        ...shared,
        lineColor: LINE,
        lineWidth: 2,
        topColor: "rgba(56, 189, 248, 0.28)",
        bottomColor: "rgba(56, 189, 248, 0.02)",
      });
  }
}

export function seriesData(style: ChartStyle, candles: readonly Candle[]) {
  return style === "line" || style === "area"
    ? candles.map((bar) => ({
        time: bar.time as UTCTimestamp,
        value: bar.close,
      }))
    : candles.map((bar) => ({ ...bar, time: bar.time as UTCTimestamp }));
}
