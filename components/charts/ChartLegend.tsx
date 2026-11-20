"use client";

import { useEffect, useState } from "react";

import type { Candle } from "@/lib/data/chart-data";
import {
  isPaneStudy,
  signalColor,
  studyLabel,
  type Study,
} from "@/lib/charts/studies";
import { signedPct, signOf } from "@/lib/format";
import { cn } from "@big-shared/ui/cn";
import { CloseIcon, EyeIcon, GearIcon } from "@/components/charts/ChartIcons";

const UP = "text-positive";
const DOWN = "text-negative";

export type LegendBar = { bar: Candle; previous: Candle | null };

export type LegendHover = {
  at: LegendBar | null;
  /** Each study's values at the bar, in the order of its lines. */
  values: Record<string, readonly (number | undefined)[]>;
};

const ACTION =
  "flex size-5 items-center justify-center rounded-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted";

/** The values a study's legend line reads, each in the colour it is drawn. */
function readings(
  study: Study,
  values: readonly (number | undefined)[],
  price: (value: number) => string,
): { value: string; color: string }[] {
  const shown = (value: number | undefined, color: string) =>
    value === undefined ? [] : [{ value: price(value), color }];
  switch (study.kind) {
    case "rsi":
      return values[0] === undefined
        ? []
        : [{ value: values[0].toFixed(2), color: study.color }];
    case "bb":
      return [values[0], values[1], values[2]].flatMap((value) =>
        shown(value, study.color),
      );
    case "macd": {
      const histogram = values[2];
      return [
        ...shown(values[0], study.color),
        ...shown(values[1], signalColor(study)),
        ...shown(
          histogram,
          histogram !== undefined && histogram < 0
            ? "var(--color-negative)"
            : "var(--color-positive)",
        ),
      ];
    }
    default:
      return shown(values[0], study.color);
  }
}

function StudyLine({
  study,
  values,
  price,
  onToggle,
  onSettings,
  onRemove,
  className,
  style,
}: {
  study: Study;
  values: readonly (number | undefined)[];
  price: (value: number) => string;
  onToggle: (id: string) => void;
  onSettings: (id: string) => void;
  onRemove: (id: string) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        "group/study pointer-events-auto flex w-fit items-center gap-1.5 rounded-sm py-px pr-1 pl-0.5 text-xs hover:bg-background/80",
        className,
      )}
    >
      <span
        className={cn(
          "whitespace-nowrap tabular-nums",
          study.hidden ? "text-disabled-foreground" : "text-body-foreground",
        )}
      >
        {studyLabel(study)}
      </span>
      {!study.hidden &&
        readings(study, values, price).map((one, i) => (
          <span key={i} className="tabular-nums" style={{ color: one.color }}>
            {one.value}
          </span>
        ))}
      <span className="flex items-center gap-0.5 opacity-0 transition group-hover/study:opacity-100 group-focus-within/study:opacity-100 pointer-coarse:opacity-100">
        <button
          type="button"
          aria-label={`${study.hidden ? "Show" : "Hide"} ${studyLabel(study)}`}
          aria-pressed={!study.hidden}
          onClick={() => onToggle(study.id)}
          className={ACTION}
        >
          <EyeIcon off={study.hidden} className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={`${studyLabel(study)} settings`}
          onClick={() => onSettings(study.id)}
          className={ACTION}
        >
          <GearIcon className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={`Remove ${studyLabel(study)}`}
          onClick={() => onRemove(study.id)}
          className={ACTION}
        >
          <CloseIcon className="size-3.5" />
        </button>
      </span>
    </div>
  );
}

export default function ChartLegend({
  symbol,
  name,
  interval,
  resting,
  onCrosshair,
  price,
  studies,
  paneTops,
  onToggle,
  onSettings,
  onRemove,
}: {
  symbol: string;
  name?: string;
  interval: string;
  resting: LegendHover;
  onCrosshair: (listener: (hover: LegendHover | null) => void) => () => void;
  price: (value: number) => string;
  studies: readonly Study[];
  /** Where each lower pane starts, by study id, from the chart's top. */
  paneTops: Readonly<Record<string, number>>;
  onToggle: (id: string) => void;
  onSettings: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [hover, setHover] = useState<LegendHover | null>(null);
  useEffect(
    () =>
      onCrosshair((next) =>
        setHover((now) => (now?.at?.bar === next?.at?.bar ? now : next)),
      ),
    [onCrosshair],
  );
  const { at, values } = hover ?? resting;
  const bar = at?.bar;
  const change = bar && at.previous ? bar.close - at.previous.close : null;
  const tone = bar && bar.close >= bar.open ? UP : DOWN;

  const actions = { onToggle, onSettings, onRemove };

  return (
    <>
      <div className="pointer-events-none absolute top-2 left-3 z-10 flex max-w-[calc(100%-5rem)] flex-col gap-0.5 text-xs">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="font-semibold text-foreground">
            {symbol}
            <span className="font-normal text-muted-foreground">
              {" "}
              · {interval}
            </span>
            {name && (
              <span className="ml-1.5 font-normal text-subtle-foreground max-sm:hidden">
                {name}
              </span>
            )}
          </span>
          {bar && (
            <span className="flex flex-wrap gap-x-2 tabular-nums">
              {(
                [
                  ["O", bar.open],
                  ["H", bar.high],
                  ["L", bar.low],
                  ["C", bar.close],
                ] as const
              ).map(([key, value]) => (
                <span key={key} className={cn(key !== "C" && "max-sm:hidden")}>
                  <span className="text-muted-foreground">{key}</span>{" "}
                  <span className={tone}>{price(value)}</span>
                </span>
              ))}
              {change !== null && at.previous && (
                <span className={change >= 0 ? UP : DOWN}>
                  {signOf(change)}
                  {price(Math.abs(change))} (
                  {signedPct((change / at.previous.close) * 100)})
                </span>
              )}
            </span>
          )}
        </div>
        {studies
          .filter((study) => !isPaneStudy(study))
          .map((study) => (
            <StudyLine
              key={study.id}
              study={study}
              values={values[study.id] ?? []}
              price={price}
              {...actions}
            />
          ))}
      </div>
      {studies.map((study) => {
        const top = paneTops[study.id];
        return isPaneStudy(study) && top !== undefined ? (
          <StudyLine
            key={study.id}
            study={study}
            values={values[study.id] ?? []}
            price={price}
            {...actions}
            className="absolute left-3 z-10"
            style={{ top: top + 4 }}
          />
        ) : null;
      })}
    </>
  );
}
