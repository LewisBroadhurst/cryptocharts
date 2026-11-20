"use client";

import {
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  LineStyle,
  PriceScaleMode,
  type IChartApi,
  type ISeriesApi,
  type Logical,
  type MouseEventParams,
  type SeriesMarker,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  BarClock,
  INTERVALS,
  RANGES,
  rangeStart,
  type Interval,
  type RangeId,
} from "@/lib/charts/bars";
import {
  CHART_STYLES,
  loadDrawings,
  loadLayout,
  saveDrawings,
  saveLayout,
  type ChartLayout,
} from "@/lib/charts/chart-storage";
import type { BacktestResult } from "@/lib/backtest/engine";
import type { Drawing, DrawingKind } from "@/lib/charts/drawings";
import {
  barsUpTo,
  indexAtOrBefore,
  nextBarTime,
  previousBarTime,
  type Replay,
  type ReplaySpeed,
} from "@/lib/charts/replay";
import {
  isPaneStudy,
  RSI_LEVELS,
  shapeSettings,
  signalColor,
  studyOutputs,
  studyShape,
  type Study,
} from "@/lib/charts/studies";
import type { LinePoint } from "@/lib/data/chart-data";
import { pairById, pairFor, type Pair } from "@/lib/market/pairs";
import { SOURCES, type Exchange } from "@/lib/market/sources";
import { cn } from "@big-shared/ui/cn";
import HoverTip from "@big-shared/ui/hover-tip";
import BacktestPanel from "@/components/charts/BacktestPanel";
import PairPicker from "@/components/charts/PairPicker";
import ReplayBar from "@/components/charts/ReplayBar";
import {
  addMain,
  addStudySeries,
  hexAlpha,
  precisionFor,
  seriesData,
  type StudySeries,
} from "@/components/charts/chartSeries";
import ChartLegend, {
  type LegendBar,
  type LegendHover,
} from "@/components/charts/ChartLegend";
import ChartPopover, { PopoverOption } from "@/components/charts/ChartPopover";
import { DrawingController } from "@/components/charts/DrawingController";
import { DrawingLayer } from "@/components/charts/DrawingLayer";
import DrawingToolbar from "@/components/charts/DrawingToolbar";
import IndicatorsDialog from "@/components/charts/IndicatorsDialog";
import ToolRail, { TOOL_KEYS, ToolMenu } from "@/components/charts/ToolRail";
import {
  ExitFullScreenIcon,
  FullScreenIcon,
  IndicatorsIcon,
  LockIcon,
  RedoIcon,
  ReplayIcon,
  CodeIcon,
  StyleIcon,
  UndoIcon,
} from "@/components/charts/ChartIcons";
import { useDrawingHistory } from "@/components/charts/useDrawingHistory";
import { exchangeInAddress, workspaceSearch } from "@/components/charts/workspaceAddress";
import { WORKSPACE_FRAME } from "@/components/charts/workspaceStyles";
import { useMarketBars } from "@/hooks/useMarketBars";

const TEXT = "#a3a3a3";
const RULE = "#262626";
const GRID = "rgba(255, 255, 255, 0.035)";
const CROSS = "#737373";

const UP_BAR = "rgba(52, 211, 153, 0.55)";
const DOWN_BAR = "rgba(251, 113, 133, 0.55)";
/** A lower pane's height against the price pane's 1: each takes about a fifth. */
const PANE_STRETCH = 0.28;

const OPENING_BARS = 150;
/** Older bars load once the view comes within this many bars of the oldest. */
const LOAD_OLDER_WITHIN = 30;
const OPENING_BAR_PX = 7;
const RIGHT_GAP = 10;

const BAR_BUTTON =
  "flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-subtle-foreground transition hover:bg-secondary hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted disabled:opacity-40 disabled:hover:bg-transparent";
const BAR_ON = "bg-secondary text-foreground";

type ScaleMode = "normal" | "log" | "percent";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.closest("input, textarea, select, dialog") !== null);

export default function ChartWorkspace({
  initialPair,
  onPickPair,
}: {
  initialPair: string;
  /** Another coin was picked: its page shows it. */
  onPickPair: (pair: Pair) => void;
}) {
  const symbol = pairFor(initialPair).id;
  const [exchange, setExchange] = useState<Exchange>(exchangeInAddress);
  const pair = pairById(symbol) ?? pairFor(undefined);
  const source = SOURCES[exchange];
  const frame = useRef<HTMLDivElement>(null);
  // iPhone browsers can put only a video full screen.
  const [canFullScreen] = useState(() => document.fullscreenEnabled);
  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    const changed = () =>
      setFullScreen(
        frame.current !== null && document.fullscreenElement === frame.current,
      );
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  const toggleFullScreen = () => {
    const done = fullScreen
      ? document.exitFullscreen()
      : frame.current?.requestFullscreen();
    done?.catch(() => {});
  };
  const [layout, setLayout] = useState<ChartLayout>(loadLayout);
  const history = useDrawingHistory(() => loadDrawings(symbol));
  const { drawings, commit } = history;
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setToolNow] = useState<DrawingKind | null>(null);
  const [drawingsHidden, setDrawingsHidden] = useState(false);
  const [drawingsLocked, setDrawingsLocked] = useState(false);
  const [dialog, setDialog] = useState<{ focus: string | null } | null>(null);
  const [scaleMode, setScaleMode] = useState<ScaleMode>("normal");
  const [autoScale, setAutoScale] = useState(true);
  const [range, setRange] = useState<RangeId | null>(null);

  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const studyRefs = useRef(new Map<string, StudySeries>());
  const paneWatch = useRef<ResizeObserver | null>(null);
  const [paneTops, setPaneTops] = useState<Record<string, number>>({});
  const layerRef = useRef<DrawingLayer | null>(null);
  const controllerRef = useRef<DrawingController | null>(null);
  const indicatorsButton = useRef<HTMLButtonElement>(null);
  const shownKey = useRef("");
  const colorRef = useRef<string | null>(null);

  const { interval, style, studies, magnet } = layout;
  const {
    candles: allCandles,
    error,
    status,
    loadOlder,
    loadingOlder,
  } = useMarketBars(pair, interval, exchange);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [backtestOpen, setBacktestOpen] = useState(false);
  // A result belongs to the bars it ran on: another pair or interval drops it.
  const [backtest, setBacktest] = useState<{
    key: string;
    result: BacktestResult;
  } | null>(null);
  const [picking, setPicking] = useState(false);
  // A replay shows no bar after its own; before the oldest bar it shows that one.
  const replayAt = replay?.at;
  const candles = useMemo(() => {
    if (replayAt === undefined) return allCandles;
    const shown = barsUpTo(allCandles, replayAt);
    return shown.length > 0 ? shown : allCandles.slice(0, 1);
  }, [allCandles, replayAt]);
  const allRef = useRef(allCandles);
  useEffect(() => {
    allRef.current = allCandles;
  }, [allCandles]);
  const [seriesMade, setSeriesMade] = useState(0);
  const drawnRef = useRef<{ key: string; first: number; length: number } | null>(
    null,
  );
  const clock = useMemo(
    () => new BarClock(candles.map((bar) => bar.time)),
    [candles],
  );
  // Each study's lines are worked out once per shape and run of bars, not on
  // every restyle.
  const shapes = [...new Set(studies.map(studyShape))].join(",");
  const lines = useMemo(() => {
    const made = new Map<string, LinePoint[][]>();
    for (const shape of shapes ? shapes.split(",") : [])
      made.set(shape, studyOutputs(shapeSettings(shape), candles));
    return made;
  }, [shapes, candles]);
  const lineOf = useCallback(
    (study: Study) => lines.get(studyShape(study)) ?? [],
    [lines],
  );
  const indexOf = useMemo(
    () => new Map(candles.map((bar, i) => [bar.time, i])),
    [candles],
  );
  const precision = precisionFor(candles.at(-1)?.close ?? 100);
  const price = useCallback(
    (value: number) => value.toFixed(precision),
    [precision],
  );

  const update = useCallback((next: Partial<ChartLayout>) => {
    setLayout((now) => {
      const merged = { ...now, ...next };
      saveLayout(merged);
      return merged;
    });
  }, []);

  const setTool = useCallback((next: DrawingKind | null) => {
    setToolNow(next);
    if (next) {
      setSelected(null);
      setDrawingsHidden(false);
    }
  }, []);

  const pickPair = (next: Pair) => {
    if (next.id !== symbol) onPickPair(next);
  };

  // The page names the coin; the address keeps only an exchange that isn't
  // the default, so it can be shared as it is.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.search = workspaceSearch(exchange);
    if (url.href !== window.location.href)
      window.history.replaceState(window.history.state, "", url);
  }, [exchange]);

  // Where each lower pane starts, for its legend line: a pane moves when one
  // above it comes or goes, the chart resizes or a reader drags a divider.
  const measurePanes = useCallback(() => {
    const element = host.current;
    if (!element) return;
    const origin = element.getBoundingClientRect().top;
    const tops: Record<string, number> = {};
    for (const [id, made] of studyRefs.current) {
      if (made.pane === 0) continue;
      const pane = made.lines[0].getPane().getHTMLElement();
      if (pane)
        tops[id] = Math.round(pane.getBoundingClientRect().top - origin);
    }
    setPaneTops((now) => {
      const ids = Object.keys(tops);
      return ids.length === Object.keys(now).length &&
        ids.every((id) => now[id] === tops[id])
        ? now
        : tops;
    });
  }, []);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const font = getComputedStyle(element).fontFamily;
    const chart = createChart(element, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: TEXT,
        fontSize: 11,
        fontFamily: font,
        attributionLogo: false,
      },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: CROSS,
          style: LineStyle.Dashed,
          labelBackgroundColor: RULE,
        },
        horzLine: {
          color: CROSS,
          style: LineStyle.Dashed,
          labelBackgroundColor: RULE,
        },
      },
      rightPriceScale: {
        borderColor: RULE,
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      timeScale: {
        borderColor: RULE,
        rightOffset: RIGHT_GAP,
        barSpacing: 8,
        minBarSpacing: 0.5,
      },
      kineticScroll: { touch: true, mouse: false },
    });
    chart.applyOptions({ layout: { panes: { separatorColor: RULE } } });
    // The price pane stays first even in the moment its series is swapped.
    chart.panes()[0].setPreserveEmptyPane(true);
    const watch = new ResizeObserver(measurePanes);
    watch.observe(element);
    paneWatch.current = watch;
    const layer = new DrawingLayer();
    layer.set({ font });
    const controller = new DrawingController(
      chart,
      element,
      layer,
      {
        commit,
        select: setSelected,
        toolDone: () => setToolNow(null),
      },
      { color: () => colorRef.current },
    );
    chartRef.current = chart;
    layerRef.current = layer;
    controllerRef.current = controller;
    const studySeries = studyRefs.current;
    return () => {
      watch.disconnect();
      paneWatch.current = null;
      controller.destroy();
      chart.remove();
      chartRef.current = null;
      mainRef.current = null;
      layerRef.current = null;
      controllerRef.current = null;
      studySeries.clear();
    };
  }, [commit, measurePanes]);

  // The price series is made again only when its style or what it shows
  // changes; live bars update it in place below.
  const viewKey = `${exchange}:${symbol}:${interval}`;
  useEffect(() => {
    const chart = chartRef.current;
    const layer = layerRef.current;
    const controller = controllerRef.current;
    if (!chart || !layer || !controller) return;
    const main = addMain(chart, style);
    main.attachPrimitive(layer);
    mainRef.current = main;
    controller.setSeries(main);
    drawnRef.current = null;
    setSeriesMade((made) => made + 1);
    return () => {
      if (chartRef.current !== chart) return;
      main.detachPrimitive(layer);
      chart.removeSeries(main);
      mainRef.current = null;
    };
  }, [style, viewKey]);

  useEffect(() => {
    const chart = chartRef.current;
    const main = mainRef.current;
    const layer = layerRef.current;
    const controller = controllerRef.current;
    if (!chart || !main || !layer || !controller || candles.length === 0)
      return;
    main.applyOptions({
      priceFormat: { type: "price", precision, minMove: 1 / 10 ** precision },
    });
    const drawn = drawnRef.current;
    const first = candles[0].time;
    const grown = drawn ? candles.length - drawn.length : 0;
    if (
      drawn &&
      drawn.key === viewKey &&
      drawn.first === first &&
      grown >= 0 &&
      grown <= 2
    ) {
      // A live tick: the newest bar moved, or one or two opened.
      for (const bar of seriesData(style, candles.slice(-(grown + 1))))
        main.update(bar);
    } else {
      const view = chart.timeScale().getVisibleLogicalRange();
      main.setData(seriesData(style, candles));
      // Older bars arrived at the left: keep the same bars in view.
      if (drawn && drawn.key === viewKey && first < drawn.first && view) {
        const added = candles.length - drawn.length;
        chart.timeScale().setVisibleLogicalRange({
          from: view.from + added,
          to: view.to + added,
        });
      }
    }
    drawnRef.current = { key: viewKey, first, length: candles.length };
    controller.setData(candles, clock);
    layer.set({ candles, clock, price });

    if (shownKey.current !== viewKey) {
      shownKey.current = viewKey;
      setRange(null);
      const fits = Math.round(chart.paneSize(0).width / OPENING_BAR_PX);
      const bars = Math.max(40, Math.min(OPENING_BARS, fits));
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, candles.length - bars),
        to: candles.length - 1 + RIGHT_GAP,
      });
    }
  }, [candles, clock, style, viewKey, precision, price, seriesMade]);

  // The backtest's trades on the price: entries as arrows, exits with their
  // return. In a replay, only those up to the replay's bar.
  const testResult =
    backtest && backtest.key === viewKey && backtest.result.ok
      ? backtest.result
      : null;
  const lastShown = candles.at(-1)?.time;
  useEffect(() => {
    const main = mainRef.current;
    if (!main || !testResult || lastShown === undefined) return;
    const marks: SeriesMarker<Time>[] = [];
    const entry = (time: number, side: "long" | "short") =>
      marks.push({
        time: time as UTCTimestamp,
        position: side === "long" ? "belowBar" : "aboveBar",
        shape: side === "long" ? "arrowUp" : "arrowDown",
        color: side === "long" ? "#34d399" : "#fb7185",
        text: side === "long" ? "Buy" : "Sell",
      });
    for (const trade of testResult.trades) {
      entry(trade.entryTime, trade.side);
      marks.push({
        time: trade.exitTime as UTCTimestamp,
        position: trade.side === "long" ? "aboveBar" : "belowBar",
        shape: "circle",
        color: "#a3a3a3",
        text: `${trade.returnPct >= 0 ? "+" : "−"}${Math.abs(trade.returnPct).toFixed(1)}%`,
      });
    }
    if (testResult.openTrade)
      entry(testResult.openTrade.entryTime, testResult.openTrade.side);
    const plugin = createSeriesMarkers(
      main,
      marks
        .filter((mark) => (mark.time as number) <= lastShown)
        .sort((a, b) => (a.time as number) - (b.time as number)),
    );
    return () => plugin.detach();
  }, [testResult, lastShown, seriesMade]);

  // Picking where a replay starts: the next click on a bar starts it there,
  // with that bar the newest one shown.
  const startReplay = useCallback((time: number) => {
    const chart = chartRef.current;
    const all = allRef.current;
    const at = indexAtOrBefore(all, time);
    if (at < 0) return;
    setPicking(false);
    setReplay((now) => ({
      at: all[at].time,
      playing: false,
      speed: now?.speed ?? 1,
    }));
    if (chart) {
      const span = chart.timeScale().getVisibleLogicalRange();
      const width = span ? Math.max(20, span.to - span.from) : OPENING_BARS;
      chart.timeScale().setVisibleLogicalRange({
        from: at - (width - RIGHT_GAP),
        to: at + RIGHT_GAP,
      });
    }
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !picking) return;
    const onClick = (param: MouseEventParams) => {
      if (param.time !== undefined) startReplay(param.time as number);
    };
    chart.subscribeClick(onClick);
    return () => chart.unsubscribeClick(onClick);
  }, [picking, startReplay]);

  const stepReplay = useCallback((by: 1 | -1) => {
    setReplay((now) => {
      if (!now) return now;
      const all = allRef.current;
      const next =
        by === 1 ? nextBarTime(all, now.at) : previousBarTime(all, now.at);
      return next === null ? now : { ...now, at: next };
    });
  }, []);

  const exitReplay = useCallback(() => {
    setReplay(null);
    setPicking(false);
    requestAnimationFrame(() => chartRef.current?.timeScale().scrollToRealTime());
  }, []);

  // Playing steps one bar at a time and pauses on catching up.
  const playing = replay?.playing ?? false;
  const speed = replay?.speed ?? 1;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setReplay((now) => {
        if (!now) return now;
        const next = nextBarTime(allRef.current, now.at);
        return next === null ? { ...now, playing: false } : { ...now, at: next };
      });
    }, 1_000 / speed);
    return () => clearInterval(timer);
  }, [playing, speed]);

  const caughtUp =
    replay !== null && nextBarTime(allCandles, replay.at) === null;
  const atStart =
    replay !== null && previousBarTime(allCandles, replay.at) === null;

  // Scrolling back near the oldest bar fetches older ones, where the exchange
  // has them.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !source.pagesBack) return;
    const onRange = (range: { from: number } | null) => {
      if (range && range.from < LOAD_OLDER_WITHIN) void loadOlder();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
  }, [loadOlder, source]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const made = studyRefs.current;
    const paneOf = new Map<string, number>();
    let next = 1;
    for (const study of studies)
      paneOf.set(study.id, isPaneStudy(study) ? next++ : 0);
    // A lower pane that has to move (one above it went) is drawn again where
    // it now goes; an emptied pane closes on its own.
    for (const [id, one] of made) {
      if (paneOf.get(id) === one.pane) continue;
      for (const line of one.lines) chart.removeSeries(line);
      made.delete(id);
    }
    for (const study of studies) {
      let one = made.get(study.id);
      if (!one) {
        one = addStudySeries(chart, study, paneOf.get(study.id) ?? 0);
        if (one.pane > 0) one.lines[0].getPane().setStretchFactor(PANE_STRETCH);
        made.set(study.id, one);
      }
      const shown = !study.hidden;
      const outputs = lineOf(study);
      const format =
        study.kind === "rsi"
          ? { type: "price" as const, precision: 2, minMove: 0.01 }
          : { type: "price" as const, precision, minMove: 1 / 10 ** precision };
      one.lines.forEach((line, i) => {
        line.applyOptions({
          visible: shown,
          priceFormat: format,
          ...(i === 0 && { lastValueVisible: shown }),
        });
        const points = outputs[i] ?? [];
        line.setData(
          study.kind === "macd" && i === 2
            ? points.map((point) => ({
                time: point.time as UTCTimestamp,
                value: point.value,
                color: point.value >= 0 ? UP_BAR : DOWN_BAR,
              }))
            : points.map((point) => ({
                time: point.time as UTCTimestamp,
                value: point.value,
              })),
        );
      });
      const [first, second, third] = one.lines;
      if (study.kind === "macd") {
        first.applyOptions({ color: study.color, lineWidth: study.width });
        second.applyOptions({
          color: signalColor(study),
          lineWidth: study.width,
          lastValueVisible: shown,
        });
      } else {
        for (const line of [first, second, third])
          line?.applyOptions({ color: study.color, lineWidth: study.width });
      }
      if (study.kind === "rsi") {
        first.applyOptions({
          autoscaleInfoProvider: () => ({
            priceRange: { minValue: 0, maxValue: 100 },
          }),
        });
        if (first.priceLines().length === 0)
          for (const level of RSI_LEVELS)
            first.createPriceLine({
              price: level,
              color: CROSS,
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: false,
            });
      }
      one.band?.set(
        outputs[1] ?? [],
        outputs[2] ?? [],
        shown ? hexAlpha(study.color, 0.07) : "transparent",
      );
    }
    for (const pane of chart.panes()) {
      const element = pane.getHTMLElement();
      if (element) paneWatch.current?.observe(element);
    }
    measurePanes();
    const frame = requestAnimationFrame(measurePanes);
    return () => cancelAnimationFrame(frame);
  }, [studies, lineOf, precision, measurePanes]);

  const onCrosshair = useCallback(
    (listener: (hover: LegendHover | null) => void) => {
      const chart = chartRef.current;
      if (!chart) return () => {};
      const onMove = (param: MouseEventParams) => {
        const index =
          param.time === undefined
            ? undefined
            : indexOf.get(param.time as number);
        if (index === undefined) {
          listener(null);
          return;
        }
        const values: LegendHover["values"] = {};
        for (const [id, one] of studyRefs.current)
          values[id] = one.lines.map(
            (line) =>
              (param.seriesData.get(line) as { value?: number } | undefined)
                ?.value,
          );
        listener({
          at: { bar: candles[index], previous: candles[index - 1] ?? null },
          values,
        });
      };
      chart.subscribeCrosshairMove(onMove);
      return () => chart.unsubscribeCrosshairMove(onMove);
    },
    [candles, indexOf],
  );

  const restingValues = useMemo(() => {
    const values: LegendHover["values"] = {};
    for (const study of studies)
      values[study.id] = lineOf(study).map((line) => line.at(-1)?.value);
    return values;
  }, [studies, lineOf]);
  const lastBar: LegendBar | null = candles.length
    ? {
        bar: candles[candles.length - 1],
        previous: candles[candles.length - 2] ?? null,
      }
    : null;

  useEffect(() => controllerRef.current?.setDrawings(drawings), [drawings]);
  useEffect(
    () => controllerRef.current?.setHidden(drawingsHidden),
    [drawingsHidden],
  );

  const savedFor = useRef({ symbol, drawings });
  useEffect(() => {
    const before = savedFor.current;
    savedFor.current = { symbol, drawings };
    if (before.symbol === symbol && before.drawings !== drawings)
      saveDrawings(symbol, drawings);
  }, [symbol, drawings]);

  const picked = drawingsHidden
    ? undefined
    : drawings.find((one) => one.id === selected);

  useEffect(() => {
    controllerRef.current?.setSelected(picked?.id ?? null);
  }, [picked]);

  useEffect(() => controllerRef.current?.setTool(tool), [tool]);

  useEffect(() => controllerRef.current?.setMagnet(magnet), [magnet]);
  useEffect(
    () => controllerRef.current?.setLocked(drawingsLocked),
    [drawingsLocked],
  );

  const changeDrawing = useCallback(
    (next: Drawing) => {
      const before = drawings.find((one) => one.id === next.id);
      if (before && before.color !== next.color) colorRef.current = next.color;
      commit(drawings.map((one) => (one.id === next.id ? next : one)));
    },
    [commit, drawings],
  );
  const removeSelected = useCallback(() => {
    if (!picked) return;
    commit(drawings.filter((one) => one.id !== picked.id));
    setSelected(null);
  }, [commit, drawings, picked]);

  const { undo, redo } = history;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.defaultPrevented) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.code === "KeyZ") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && event.code === "KeyY") {
        event.preventDefault();
        redo();
        return;
      }
      if (event.key === "Escape" && picking) {
        setPicking(false);
        return;
      }
      if (replay && event.shiftKey && !mod && event.key === "ArrowRight") {
        event.preventDefault();
        stepReplay(1);
        return;
      }
      if (replay && event.shiftKey && !mod && event.key === "ArrowLeft") {
        event.preventDefault();
        stepReplay(-1);
        return;
      }
      if (event.key === "Escape") {
        if (controllerRef.current?.cancelPlacing()) return;
        if (tool) setTool(null);
        else setSelected(null);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && picked) {
        event.preventDefault();
        removeSelected();
        return;
      }
      if (event.altKey && !mod) {
        const kind = (Object.keys(TOOL_KEYS) as DrawingKind[]).find(
          (one) => TOOL_KEYS[one]?.code === event.code,
        );
        if (kind) {
          event.preventDefault();
          setTool(tool === kind ? null : kind);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, tool, setTool, picked, removeSelected, picking, replay, stepReplay]);

  useEffect(() => {
    chartRef.current?.priceScale("right").applyOptions({
      mode:
        scaleMode === "log"
          ? PriceScaleMode.Logarithmic
          : scaleMode === "percent"
            ? PriceScaleMode.Percentage
            : PriceScaleMode.Normal,
      autoScale,
    });
  }, [scaleMode, autoScale]);

  const showRange = (id: RangeId) => {
    const chart = chartRef.current;
    const last = candles.at(-1);
    if (!chart || !last) return;
    setRange(id);
    const start = rangeStart(id, last.time);
    const from =
      start === null ? 0 : Math.max(0, Math.ceil(clock.logicalOf(start)));
    chart.timeScale().setVisibleLogicalRange({
      from: from as Logical,
      to: (candles.length - 1 + RIGHT_GAP / 2) as Logical,
    });
    setAutoScale(true);
  };

  const editStudies = (next: Study[]) => update({ studies: next });

  const rail = {
    tool,
    onTool: setTool,
    magnet,
    onMagnet: (on: boolean) => update({ magnet: on }),
    hidden: drawingsHidden,
    onHidden: setDrawingsHidden,
    locked: drawingsLocked,
    onLocked: setDrawingsLocked,
    hasDrawings: drawings.length > 0,
    onClear: () => {
      commit([]);
      setSelected(null);
    },
  };

  const intervalLabel =
    INTERVALS.find((one) => one.id === interval)?.label ?? interval;

  return (
    <div
      ref={frame}
      className={cn(
        WORKSPACE_FRAME,
        "[&:fullscreen]:rounded-none [&:fullscreen]:border-0",
      )}
    >
      <div
        role="toolbar"
        aria-label="Chart"
        className="relative z-40 flex shrink-0 items-center gap-1 border-b border-border px-1.5 py-1"
      >
        <PairPicker
          current={pair}
          onPick={pickPair}
          buttonClassName={cn(BAR_BUTTON, "gap-0.5 px-2.5")}
        />
        <ChartPopover
          label="Exchange"
          className="shrink-0"
          panelClassName="w-44"
          trigger={(props) => (
            <HoverTip control tip="Where the prices come from">
              <button
                {...props}
                aria-label={`Exchange: ${source.label}. Change exchange`}
                className={BAR_BUTTON}
              >
                {source.label}
              </button>
            </HoverTip>
          )}
        >
          {(close) =>
            Object.values(SOURCES).map((one) =>
              one.available ? (
                <PopoverOption
                  key={one.exchange}
                  active={exchange === one.exchange}
                  onPick={() => {
                    setExchange(one.exchange);
                    close();
                  }}
                >
                  {one.label}
                  {!one.pagesBack && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      720 bars
                    </span>
                  )}
                </PopoverOption>
              ) : (
                <HoverTip
                  key={one.exchange}
                  control
                  tip={`${one.label} prices coming soon`}
                >
                  {/* aria-disabled, not disabled: a disabled button gets no
                      hover, so its tip could never say why. */}
                  <button
                    type="button"
                    aria-disabled="true"
                    aria-label={`${one.label}: coming soon`}
                    className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground"
                  >
                    {one.label}
                    <LockIcon className="ml-auto size-4" />
                  </button>
                </HoverTip>
              ),
            )
          }
        </ChartPopover>
        <div aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
        <div
          role="group"
          aria-label="Interval"
          className="flex shrink-0 gap-0.5"
        >
          {INTERVALS.map((one) => (
            <button
              key={one.id}
              type="button"
              aria-pressed={interval === one.id}
              onClick={() => update({ interval: one.id as Interval })}
              className={cn(
                BAR_BUTTON,
                "tabular-nums",
                interval === one.id && BAR_ON,
              )}
            >
              {one.label}
            </button>
          ))}
        </div>
        <div aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
        <ChartPopover
          label="Chart style"
          className="shrink-0"
          panelClassName="w-40"
          trigger={(props) => (
            <HoverTip control tip="Chart style">
              <button
                {...props}
                aria-label="Chart style"
                className={BAR_BUTTON}
              >
                <StyleIcon style={style} className="size-5" />
              </button>
            </HoverTip>
          )}
        >
          {(close) =>
            CHART_STYLES.map((one) => (
              <PopoverOption
                key={one.id}
                active={style === one.id}
                onPick={() => {
                  update({ style: one.id });
                  close();
                }}
                className="transition"
              >
                <StyleIcon style={one.id} className="size-5" />
                {one.label}
              </PopoverOption>
            ))
          }
        </ChartPopover>
        <button
          ref={indicatorsButton}
          type="button"
          onClick={() => setDialog({ focus: null })}
          className={cn(BAR_BUTTON, "shrink-0")}
        >
          <IndicatorsIcon className="size-5" />
          <span className="max-sm:hidden">Indicators</span>
        </button>
        <HoverTip
          control
          tip={
            replay
              ? "Back to live"
              : "Bar replay"
          }
        >
          <button
            type="button"
            aria-pressed={picking || replay !== null}
            onClick={() => {
              if (replay) exitReplay();
              else {
                setTool(null);
                setPicking((now) => !now);
              }
            }}
            className={cn(
              BAR_BUTTON,
              "shrink-0",
              (picking || replay) && BAR_ON,
            )}
          >
            <ReplayIcon className="size-5" />
            <span className="max-sm:hidden">Replay</span>
          </button>
        </HoverTip>
        <HoverTip control tip="Backtest a Python strategy on these bars">
          <button
            type="button"
            aria-pressed={backtestOpen}
            onClick={() => setBacktestOpen((now) => !now)}
            className={cn(BAR_BUTTON, "shrink-0", backtestOpen && BAR_ON)}
          >
            <CodeIcon className="size-5" />
            <span className="max-sm:hidden">Backtest</span>
          </button>
        </HoverTip>
        <div className="shrink-0 sm:hidden">
          <ToolMenu
            {...rail}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            onUndo={undo}
            onRedo={redo}
          />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-0.5 max-sm:hidden">
          <HoverTip control tip="Undo">
            <button
              type="button"
              aria-label="Undo"
              disabled={!history.canUndo}
              onClick={undo}
              className={BAR_BUTTON}
            >
              <UndoIcon className="size-4.5" />
            </button>
          </HoverTip>
          <HoverTip control tip="Redo">
            <button
              type="button"
              aria-label="Redo"
              disabled={!history.canRedo}
              onClick={redo}
              className={BAR_BUTTON}
            >
              <RedoIcon className="size-4.5" />
            </button>
          </HoverTip>
          {canFullScreen && (
            <>
              <div aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
              <HoverTip
                control
                tip={fullScreen ? "Exit full screen" : "Full screen"}
              >
                <button
                  type="button"
                  aria-label={fullScreen ? "Exit full screen" : "Full screen"}
                  onClick={toggleFullScreen}
                  className={BAR_BUTTON}
                >
                  {fullScreen ? (
                    <ExitFullScreenIcon className="size-4.5" />
                  ) : (
                    <FullScreenIcon className="size-4.5" />
                  )}
                </button>
              </HoverTip>
            </>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative z-30 max-sm:hidden">
          <ToolRail {...rail} />
        </div>
        <div className="relative min-w-0 flex-1 touch-none select-none">
          <div
            ref={host}
            className={cn(
              "absolute inset-0",
              (tool || picking) && "cursor-crosshair",
            )}
          />
          <ChartLegend
            symbol={pair.id}
            name={pair.name}
            interval={intervalLabel}
            resting={{ at: lastBar, values: restingValues }}
            onCrosshair={onCrosshair}
            price={price}
            studies={studies}
            paneTops={paneTops}
            onToggle={(id) =>
              editStudies(
                studies.map((one) =>
                  one.id === id ? { ...one, hidden: !one.hidden } : one,
                ),
              )
            }
            onSettings={(id) => setDialog({ focus: id })}
            onRemove={(id) =>
              editStudies(studies.filter((one) => one.id !== id))
            }
          />
          {picked && (
            <DrawingToolbar
              drawing={picked}
              onChange={changeDrawing}
              onRemove={removeSelected}
            />
          )}
          {picking && (
            <p
              role="status"
              className="pointer-events-none absolute top-2 left-1/2 z-20 -translate-x-1/2 rounded-md border border-border-strong bg-popover px-2.5 py-1.5 text-xs text-foreground shadow-popover"
            >
              Click a bar to replay from it. Esc to cancel.
            </p>
          )}
          {replay && (
            <ReplayBar
              replay={replay}
              caughtUp={caughtUp}
              atStart={atStart}
              onPlay={(on) =>
                setReplay((now) => (now ? { ...now, playing: on } : now))
              }
              onStep={stepReplay}
              onSpeed={(next: ReplaySpeed) =>
                setReplay((now) => (now ? { ...now, speed: next } : now))
              }
              onExit={exitReplay}
            />
          )}
          {(candles.length === 0 || error) && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 text-sm">
              {error ? (
                <span className="max-w-sm px-4 text-center text-negative">
                  Couldn&apos;t load {pair.id} prices from {source.label}.
                  {exchange === "coinbase"
                    ? " Try Kraken from the exchange menu."
                    : " Refresh the page to try again."}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Loading {pair.id} from {source.label}…
                </span>
              )}
            </div>
          )}
        </div>
        {backtestOpen && (
          <BacktestPanel
            bars={allCandles}
            label={`${pair.id} · ${intervalLabel} · ${source.label}`}
            upTo={replay ? (candles.at(-1)?.time ?? null) : null}
            result={backtest?.key === viewKey ? backtest.result : null}
            onResult={(result) =>
              setBacktest(result ? { key: viewKey, result } : null)
            }
            onClose={() => setBacktestOpen(false)}
          />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-t border-border px-1.5 py-0.5 [scrollbar-width:none]">
        <div role="group" aria-label="Range" className="flex gap-0.5">
          {RANGES.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={range === id}
              onClick={() => showRange(id)}
              className={cn(
                BAR_BUTTON,
                "h-7 px-1.5",
                range === id && "text-brand",
              )}
            >
              {id === "ALL" ? "All" : id}
            </button>
          ))}
        </div>
        <p className="ml-2 flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              status === "live" ? "bg-positive" : "bg-muted-foreground",
            )}
          />
          <span className="sr-only">
            {replay ? "Replaying" : status === "live" ? "Live" : "Connecting"}
          </span>
          {loadingOlder ? "Loading older bars… · " : ""}Data from{" "}
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            {source.label}
          </a>
        </p>
        <div className="ml-auto flex items-center gap-0.5">
          {(
            [
              [
                "percent",
                "%",
                "Percent scale",
              ],
              [
                "log",
                "log",
                "Log scale",
              ],
            ] as const
          ).map(([mode, label, tip]) => (
            <HoverTip key={mode} control tip={tip}>
              <button
                type="button"
                aria-label={tip}
                aria-pressed={scaleMode === mode}
                onClick={() =>
                  setScaleMode((now) => (now === mode ? "normal" : mode))
                }
                className={cn(
                  BAR_BUTTON,
                  "h-7 px-1.5",
                  scaleMode === mode && "text-brand",
                )}
              >
                {label}
              </button>
            </HoverTip>
          ))}
          <HoverTip control tip="Fit the prices on screen">
            <button
              type="button"
              aria-label="Fit the prices on screen"
              aria-pressed={autoScale}
              onClick={() => setAutoScale((now) => !now)}
              className={cn(
                BAR_BUTTON,
                "h-7 px-1.5",
                autoScale && "text-brand",
              )}
            >
              auto
            </button>
          </HoverTip>
        </div>
      </div>

      {dialog && (
        <IndicatorsDialog
          studies={studies}
          focusId={dialog.focus}
          onChange={editStudies}
          onClose={() => setDialog(null)}
          returnFocusTo={indicatorsButton}
        />
      )}
    </div>
  );
}
