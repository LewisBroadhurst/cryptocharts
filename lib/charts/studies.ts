import { bollinger, macd, rsi } from "@/lib/charts/indicators";
import { ema, type Candle, type LinePoint } from "@/lib/data/chart-data";
import { EMA_COLOR } from "@/lib/site/ema-color";

export type StudyKind = "ema" | "sma" | "bb" | "rsi" | "macd";

export const STUDY_KINDS: readonly StudyKind[] = [
  "ema",
  "sma",
  "bb",
  "rsi",
  "macd",
];

/**
 * `length` is the study's one length, or MACD's fast one; MACD alone carries
 * `slow` and `signal`.
 */
export type Study = {
  id: string;
  kind: StudyKind;
  length: number;
  slow?: number;
  signal?: number;
  color: string;
  width: 1 | 2 | 3 | 4;
  hidden?: boolean;
};

export const STUDY_NAMES: Record<StudyKind, string> = {
  ema: "EMA",
  sma: "SMA",
  bb: "BB",
  rsi: "RSI",
  macd: "MACD",
};

export const STUDY_TITLES: Record<StudyKind, string> = {
  ema: "Exponential moving average",
  sma: "Simple moving average",
  bb: "Bollinger Bands",
  rsi: "Relative strength index",
  macd: "MACD",
};

/** Studies drawn in a pane of their own under the price, not over it. */
export const isPaneStudy = (study: Pick<Study, "kind">) =>
  study.kind === "rsi" || study.kind === "macd";

export const BB_DEVIATIONS = 2;
export const RSI_LEVELS = [70, 30] as const;
export const MACD_DEFAULTS = { length: 12, slow: 26, signal: 9 } as const;

export type StudyField = "length" | "slow" | "signal";

/** The lengths a reader can set on each kind, in the order they are read. */
export const STUDY_FIELDS: Record<
  StudyKind,
  readonly { key: StudyField; label: string }[]
> = {
  ema: [{ key: "length", label: "Length" }],
  sma: [{ key: "length", label: "Length" }],
  bb: [{ key: "length", label: "Length" }],
  rsi: [{ key: "length", label: "Length" }],
  macd: [
    { key: "length", label: "Fast" },
    { key: "slow", label: "Slow" },
    { key: "signal", label: "Signal" },
  ],
};

type StudySettings = Pick<Study, "kind" | "length" | "slow" | "signal">;

export const fieldOf = (study: StudySettings, key: StudyField): number =>
  key === "length" ? study.length : (study[key] ?? MACD_DEFAULTS[key]);

export const MIN_LENGTH = 1;
export const MAX_LENGTH = 500;

export const LINE_COLORS = [
  EMA_COLOR,
  "#38bdf8",
  "#f472b6",
  "#a78bfa",
  "#fb923c",
  "#2dd4bf",
  "#f87171",
  "#e5e5e5",
] as const;

export const STUDY_PRESETS: readonly { kind: StudyKind; length: number }[] = [
  { kind: "ema", length: 9 },
  { kind: "ema", length: 21 },
  { kind: "ema", length: 50 },
  { kind: "ema", length: 100 },
  { kind: "ema", length: 200 },
  { kind: "sma", length: 20 },
  { kind: "sma", length: 50 },
  { kind: "sma", length: 200 },
];

/** The other studies, each at the settings it is usually read at. */
export const INDICATOR_PRESETS: readonly {
  kind: StudyKind;
  length: number;
  blurb: string;
}[] = [
  {
    kind: "bb",
    length: 20,
    blurb: "A band two standard deviations either side of the 20-bar average.",
  },
  {
    kind: "rsi",
    length: 14,
    blurb: "Momentum from 0 to 100; over 70 is stretched, under 30 washed out.",
  },
  {
    kind: "macd",
    length: 12,
    blurb: "The gap between a fast and slow average, against its own signal.",
  },
];

/** The site draws EMA200 in yellow everywhere; a chart keeps to it. */
const LENGTH_COLORS: Record<number, string> = {
  200: EMA_COLOR,
  50: "#38bdf8",
  21: "#f472b6",
  9: "#2dd4bf",
  100: "#a78bfa",
  20: "#fb923c",
};

export const DEFAULT_STUDIES: readonly Study[] = [
  { id: "ema-50", kind: "ema", length: 50, color: "#38bdf8", width: 2 },
  { id: "ema-200", kind: "ema", length: 200, color: EMA_COLOR, width: 2 },
];

/** The colour a kind is usually drawn in, before any length's. */
const KIND_COLORS: Partial<Record<StudyKind, string>> = {
  rsi: "#a78bfa",
  macd: "#38bdf8",
};

export function studyLabel(
  study: Pick<Study, "kind" | "length" | "slow" | "signal">,
): string {
  const name = STUDY_NAMES[study.kind];
  if (study.kind === "bb") return `${name} ${study.length} ${BB_DEVIATIONS}`;
  if (study.kind === "macd")
    return `${name} ${study.length} ${study.slow ?? MACD_DEFAULTS.slow} ${study.signal ?? MACD_DEFAULTS.signal}`;
  return `${name} ${study.length}`;
}

/** MACD's signal line, in a colour of its own beside the study's. */
export const signalColor = (study: Pick<Study, "color">) =>
  study.color === "#fb923c" ? "#f472b6" : "#fb923c";

export function nextColor(
  length: number,
  taken: readonly Study[],
  kind?: StudyKind,
): string {
  const used = new Set(taken.map((study) => study.color));
  const usual = (kind && KIND_COLORS[kind]) ?? LENGTH_COLORS[length];
  if (usual && !used.has(usual)) return usual;
  return LINE_COLORS.find((color) => !used.has(color)) ?? LINE_COLORS[0];
}

export function makeStudy(
  kind: StudyKind,
  length: number,
  taken: readonly Study[],
): Study {
  const ids = new Set(taken.map((study) => study.id));
  let id = `${kind}-${length}`;
  for (let n = 2; ids.has(id); n++) id = `${kind}-${length}-${n}`;
  return {
    id,
    kind,
    length,
    ...(kind === "macd" && {
      slow: MACD_DEFAULTS.slow,
      signal: MACD_DEFAULTS.signal,
    }),
    color: nextColor(length, taken, kind),
    width: kind === "bb" ? 1 : 2,
  };
}

export const clampLength = (value: number) =>
  Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.round(value)));

export function emaLine(
  candles: readonly Candle[],
  length: number,
): LinePoint[] {
  if (candles.length < length) return [];
  const values = ema(
    candles.map((candle) => candle.close),
    length,
  );
  return candles
    .slice(length - 1)
    .map((candle, i) => ({ time: candle.time, value: values[length - 1 + i] }));
}

export function smaLine(
  candles: readonly Candle[],
  length: number,
): LinePoint[] {
  const out: LinePoint[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= length) sum -= candles[i - length].close;
    if (i >= length - 1)
      out.push({ time: candles[i].time, value: sum / length });
  }
  return out;
}

/** A key naming what a study draws from a run of bars, whatever its look. */
export const studyShape = (study: StudySettings) =>
  study.kind === "macd"
    ? `macd:${study.length}:${fieldOf(study, "slow")}:${fieldOf(study, "signal")}`
    : `${study.kind}:${study.length}`;

/**
 * The lines a study draws, in a fixed order: one for an average or RSI; the
 * middle, upper and lower band; MACD, its signal and the histogram.
 */
export function studyOutputs(
  study: StudySettings,
  candles: readonly Candle[],
): LinePoint[][] {
  switch (study.kind) {
    case "ema":
      return [emaLine(candles, study.length)];
    case "sma":
      return [smaLine(candles, study.length)];
    case "bb": {
      const bands = bollinger(candles, study.length, BB_DEVIATIONS);
      return [bands.middle, bands.upper, bands.lower];
    }
    case "rsi":
      return [rsi(candles, study.length)];
    case "macd": {
      const out = macd(
        candles,
        study.length,
        fieldOf(study, "slow"),
        fieldOf(study, "signal"),
      );
      return [out.macd, out.signal, out.histogram];
    }
  }
}

/** The settings a `studyShape` key names. */
export function shapeSettings(shape: string): StudySettings {
  const [kind, length, slow, signal] = shape.split(":");
  return {
    kind: kind as StudyKind,
    length: Number(length),
    ...(kind === "macd" && { slow: Number(slow), signal: Number(signal) }),
  };
}
