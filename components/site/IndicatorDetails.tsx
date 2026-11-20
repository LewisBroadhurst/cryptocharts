import type { ReactNode } from "react";

import {
  Figures,
  Prose,
  SECTION,
  Stamp,
  TopicLinks,
  Unavailable,
} from "@/components/site/topic-parts";
import type { Candle } from "@/lib/data/chart-data";
import { chartDay } from "@/lib/dates";
import { signedPct } from "@/lib/format";
import { fetchDailyBars } from "@/lib/market/daily";
import type { Pair } from "@/lib/market/pairs";
import { usd } from "@/lib/market/snapshot";
import type { IndicatorId } from "@/lib/site/pages";
import {
  crossReading,
  daysBetween,
  rsiReading,
  smaReading,
  type RsiZone,
} from "@/lib/site/readings";
import { topicStructuredData } from "@/lib/site/seo";

const ZONE: Record<RsiZone, string> = {
  overbought: "Overbought",
  oversold: "Oversold",
  neutral: "Neutral",
};

const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;

function Rsi({ pair, bars, now }: { pair: Pair; bars: Candle[]; now: number }) {
  const reading = rsiReading(bars);
  if (!reading) return <Unavailable />;
  const first = chartDay(bars[0].time);
  const last = (time: number | null, word: string) =>
    time === null
      ? `It hasn't been ${word} since at least ${first}.`
      : time === reading.at
        ? null
        : `It was last ${word} on ${chartDay(time)}, ${days(daysBetween(time, reading.at))} ago.`;
  const lastDay = (time: number | null) =>
    time === null ? "—" : time === reading.at ? "Now" : chartDay(time);
  const zone =
    reading.zone === "neutral"
      ? "neutral, between oversold (30) and overbought (70)"
      : reading.zone === "overbought"
        ? "overbought, above 70"
        : "oversold, below 30";

  return (
    <>
      <Figures
        figures={[
          ["RSI 14 (1D)", reading.value.toFixed(1)],
          ["Zone", ZONE[reading.zone]],
          ["90-day range", `${reading.low90.toFixed(1)}–${reading.high90.toFixed(1)}`],
          ["Last overbought", lastDay(reading.lastOverbought)],
          ["Last oversold", lastDay(reading.lastOversold)],
        ]}
      />
      <Prose>
        {pair.name}&apos;s daily RSI is {reading.value.toFixed(1)}: {zone}.{" "}
        {reading.zone !== "overbought" && last(reading.lastOverbought, "overbought")}{" "}
        {reading.zone !== "oversold" && last(reading.lastOversold, "oversold")} Over the last 90
        days it has ranged from {reading.low90.toFixed(1)} to {reading.high90.toFixed(1)}.
      </Prose>
      <Stamp at={now} />
      <Prose>RSI 14 on daily closes, with Wilder&apos;s smoothing.</Prose>
    </>
  );
}

function MovingAverage({ pair, bars, now }: { pair: Pair; bars: Candle[]; now: number }) {
  const reading = smaReading(bars, 200);
  if (!reading) return <Unavailable />;
  const side = reading.above ? "above" : "below";
  const run =
    reading.since === null
      ? `It has closed ${side} it on every one of the ${days(reading.days)} we have data for.`
      : `It has closed ${side} it for ${days(reading.days)}, since ${chartDay(reading.since)}${
          reading.longerRunEnded
            ? `, its longest run ${side} since ${chartDay(reading.longerRunEnded)}.`
            : `, its longest run ${side} it in the last ${days(bars.length - 199)}.`
        }`;

  return (
    <>
      <Figures
        figures={[
          ["Price", usd(reading.price)],
          ["200-day SMA", usd(reading.sma)],
          ["Distance", signedPct(reading.distancePct)],
          [reading.above ? "Above since" : "Below since", reading.since ? chartDay(reading.since) : "—"],
        ]}
      />
      <Prose>
        {pair.name} is {Math.abs(reading.distancePct).toFixed(1)}% {side} its 200-day moving
        average of {usd(reading.sma)}. {run}
      </Prose>
      <Stamp at={now} />
      <Prose>Simple moving average of the last 200 daily closes.</Prose>
    </>
  );
}

function GoldenCross({ pair, bars, now }: { pair: Pair; bars: Candle[]; now: number }) {
  const reading = crossReading(bars);
  if (!reading) return <Unavailable />;
  const latest = reading.crosses[0];
  const name = (kind: "golden" | "death") => (kind === "golden" ? "Golden cross" : "Death cross");
  const closeOn = new Map(bars.map((bar) => [bar.time, bar.close]));
  const price = bars.at(-1)!.close;
  const span = bars.length - 199;

  let story: ReactNode;
  if (latest) {
    story = `${pair.name}'s 50-day SMA crossed ${
      latest.kind === "golden" ? "above" : "below"
    } its 200-day SMA on ${chartDay(latest.time)}: a ${name(latest.kind).toLowerCase()}, ${days(
      daysBetween(latest.time, reading.at),
    )} ago.`;
  } else {
    story = `${pair.name}'s 50-day SMA has been ${
      reading.state === "golden" ? "above" : "below"
    } its 200-day SMA for all of the last ${days(span)}.`;
  }

  return (
    <>
      <Figures
        figures={[
          ["Now", name(reading.state)],
          ["Since", latest ? chartDay(latest.time) : "—"],
          ["50-day SMA", usd(reading.fast)],
          ["200-day SMA", usd(reading.slow)],
          ["Gap", signedPct(reading.gapPct)],
        ]}
      />
      <Prose>
        {story} The 50-day is {Math.abs(reading.gapPct).toFixed(1)}%{" "}
        {reading.gapPct >= 0 ? "above" : "below"} the 200-day.
      </Prose>
      <Stamp at={now} />
      {reading.crosses.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            Crosses in the last {days(span)}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full max-w-xl whitespace-nowrap text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-normal">Date</th>
                  <th className="py-1 pr-3 font-normal">Cross</th>
                  <th className="py-1 pr-3 text-right font-normal">Close</th>
                  <th className="py-1 text-right font-normal">Change since</th>
                </tr>
              </thead>
              <tbody>
                {reading.crosses.slice(0, 8).map((cross) => {
                  const close = closeOn.get(cross.time)!;
                  return (
                    <tr key={cross.time} className="border-t border-border">
                      <td className="py-1.5 pr-3">{chartDay(cross.time)}</td>
                      <td className="py-1.5 pr-3">{name(cross.kind)}</td>
                      <td className="py-1.5 pr-3 text-right">{usd(close)}</td>
                      <td className="py-1.5 text-right">{signedPct((price / close - 1) * 100)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

const READINGS: Record<
  IndicatorId,
  (props: { pair: Pair; bars: Candle[]; now: number }) => ReactNode
> = {
  rsi: Rsi,
  "200-day-moving-average": MovingAverage,
  "golden-cross": GoldenCross,
};

/**
 * What follows the chart on an indicator's page: its reading now, a few
 * sentences written from the numbers, and links on. The heading and chart come
 * from the layout.
 */
export default async function IndicatorDetails({
  pair,
  indicator,
}: {
  pair: Pair;
  indicator: IndicatorId;
}) {
  const daily = await fetchDailyBars(pair);
  const Reading = READINGS[indicator];
  const page = { kind: "indicator", pair, indicator } as const;

  return (
    <section aria-label="Reading" className={SECTION}>
      <script
        type="application/ld+json"
        // Built from our own constants, never from a request.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(topicStructuredData(page)) }}
      />
      {daily ? <Reading pair={pair} bars={daily.bars} now={daily.at} /> : <Unavailable />}
      <TopicLinks page={page} />
    </section>
  );
}
