import { isInterval, type Interval } from "@/lib/charts/bars";
import { HEX_COLOR, readDrawing, type Drawing } from "@/lib/charts/drawings";
import {
  clampLength,
  DEFAULT_STUDIES,
  MACD_DEFAULTS,
  STUDY_KINDS,
  type Study,
  type StudyKind,
} from "@/lib/charts/studies";
import { readStoredJson, writeStoredJson } from "@/lib/site/browser-storage";
import { EMA_COLOR } from "@/lib/site/ema-color";

export type ChartStyle = "candles" | "bars" | "line" | "area";

export const CHART_STYLES: readonly { id: ChartStyle; label: string }[] = [
  { id: "candles", label: "Candles" },
  { id: "bars", label: "Bars" },
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
];

export type ChartLayout = {
  interval: Interval;
  style: ChartStyle;
  studies: Study[];
  magnet: boolean;
};

export const DEFAULT_LAYOUT: ChartLayout = {
  interval: "1h",
  style: "candles",
  studies: [...DEFAULT_STUDIES],
  magnet: true,
};

const LAYOUT_KEY = "cryptocharts.layout.v1";
const DRAWINGS_KEY = (symbol: string) =>
  `cryptocharts.drawings.v1:${symbol}`;

const STYLE_IDS = new Set<string>(CHART_STYLES.map((style) => style.id));

function readStudy(value: unknown): Study | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string") return null;
  if (!STUDY_KINDS.includes(raw.kind as StudyKind)) return null;
  const kind = raw.kind as StudyKind;
  if (typeof raw.length !== "number" || !Number.isFinite(raw.length))
    return null;
  const lengthOr = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? clampLength(value)
      : fallback;
  return {
    id: raw.id,
    kind,
    length: clampLength(raw.length),
    ...(kind === "macd" && {
      slow: lengthOr(raw.slow, MACD_DEFAULTS.slow),
      signal: lengthOr(raw.signal, MACD_DEFAULTS.signal),
    }),
    color:
      typeof raw.color === "string" && HEX_COLOR.test(raw.color)
        ? raw.color
        : EMA_COLOR,
    width: [1, 2, 3, 4].includes(raw.width as number)
      ? (raw.width as Study["width"])
      : 2,
    ...(raw.hidden === true && { hidden: true }),
  };
}

export function readLayout(value: unknown): ChartLayout {
  if (typeof value !== "object" || value === null) return DEFAULT_LAYOUT;
  const raw = value as Record<string, unknown>;
  const studies = Array.isArray(raw.studies)
    ? raw.studies
        .map(readStudy)
        .filter((study): study is Study => study !== null)
    : DEFAULT_LAYOUT.studies;
  return {
    interval: isInterval(raw.interval) ? raw.interval : DEFAULT_LAYOUT.interval,
    style: STYLE_IDS.has(raw.style as string)
      ? (raw.style as ChartStyle)
      : DEFAULT_LAYOUT.style,
    studies,
    magnet:
      typeof raw.magnet === "boolean" ? raw.magnet : DEFAULT_LAYOUT.magnet,
  };
}

export const readDrawings = (value: unknown): Drawing[] =>
  Array.isArray(value)
    ? value.map(readDrawing).filter((one): one is Drawing => one !== null)
    : [];

// A store the browser refuses reads as nothing saved, and a refused write is
// let go: the chart works on as it is.
export const loadLayout = () => readLayout(readStoredJson(LAYOUT_KEY));
export const saveLayout = (layout: ChartLayout) => {
  writeStoredJson(LAYOUT_KEY, layout);
};
export const loadDrawings = (symbol: string) =>
  readDrawings(readStoredJson(DRAWINGS_KEY(symbol)));
export const saveDrawings = (symbol: string, drawings: readonly Drawing[]) => {
  writeStoredJson(DRAWINGS_KEY(symbol), drawings);
};
