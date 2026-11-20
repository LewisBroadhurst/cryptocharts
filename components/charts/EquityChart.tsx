"use client";

import {
  AreaSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

const TEXT = "#a3a3a3";
const RULE = "#262626";
const LINE = "#38bdf8";

/** The strategy's account value over the run, as a small area chart. */
export default function EquityChart({
  points,
}: {
  points: readonly { time: number; value: number }[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const made = createChart(element, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: TEXT,
        fontSize: 10,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "rgba(255,255,255,0.035)" } },
      rightPriceScale: { borderColor: RULE },
      timeScale: { borderColor: RULE, timeVisible: true },
      handleScroll: false,
      handleScale: false,
    });
    series.current = made.addSeries(AreaSeries, {
      lineColor: LINE,
      topColor: "rgba(56, 189, 248, 0.25)",
      bottomColor: "rgba(56, 189, 248, 0)",
      lineWidth: 2,
      priceFormat: { type: "price", precision: 0, minMove: 1 },
    });
    chart.current = made;
    return () => {
      made.remove();
      chart.current = null;
      series.current = null;
    };
  }, []);

  useEffect(() => {
    series.current?.setData(
      points.map((point) => ({ time: point.time as UTCTimestamp, value: point.value })),
    );
    chart.current?.timeScale().fitContent();
  }, [points]);

  return <div ref={host} aria-label="Account value over the backtest" role="img" className="h-32 w-full" />;
}
