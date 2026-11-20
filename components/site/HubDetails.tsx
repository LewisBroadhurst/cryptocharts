import Link from "next/link";

import { coinHref, Prose, Stamp } from "@/components/site/topic-parts";
import type { Candle } from "@/lib/data/chart-data";
import { chartDay } from "@/lib/dates";
import { signedPct } from "@/lib/format";
import { fetchDailyBars } from "@/lib/market/daily";
import { PAIRS, type Pair } from "@/lib/market/pairs";
import { usd } from "@/lib/market/snapshot";
import { hubPath, HUB_IDS, type HubId, type IndicatorId } from "@/lib/site/pages";
import { crossReading, rsiReading, type RsiZone } from "@/lib/site/readings";
import { HUBS } from "@/lib/site/seo";

const ZONE: Record<RsiZone, string> = {
  overbought: "Overbought",
  oversold: "Oversold",
  neutral: "Neutral",
};

const CELL = "py-1.5 pr-3";
const HEAD = "py-1 pr-3 font-normal";

function CoinCell({ pair, indicator }: { pair: Pair; indicator: IndicatorId }) {
  return (
    <td className={CELL}>
      <Link
        href={coinHref(pair, indicator)}
        className="text-foreground underline-offset-2 hover:underline"
      >
        {pair.name}
      </Link>
    </td>
  );
}

type Row = { pair: Pair; bars: Candle[] | null };

function RsiTable({ rows }: { rows: Row[] }) {
  const read = rows
    .map((row) => ({ ...row, reading: row.bars && rsiReading(row.bars) }))
    .sort((a, b) => (b.reading?.value ?? -1) - (a.reading?.value ?? -1));
  const count = (zone: RsiZone) => read.filter((row) => row.reading?.zone === zone).length;

  return (
    <>
      <Prose>
        {count("overbought")} of {read.length} coins are overbought on the daily RSI and{" "}
        {count("oversold")} oversold.
      </Prose>
      <div className="overflow-x-auto">
        <table className="w-full max-w-2xl whitespace-nowrap text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className={HEAD}>Coin</th>
              <th className={`${HEAD} text-right`}>RSI 14 (1D)</th>
              <th className={HEAD}>Zone</th>
              <th className={`${HEAD} text-right`}>Price</th>
            </tr>
          </thead>
          <tbody>
            {read.map(({ pair, bars, reading }) => (
              <tr key={pair.id} className="border-t border-border">
                <CoinCell pair={pair} indicator="rsi" />
                <td className={`${CELL} text-right`}>{reading ? reading.value.toFixed(1) : "—"}</td>
                <td className={CELL}>{reading ? ZONE[reading.zone] : "—"}</td>
                <td className={`${CELL} text-right`}>{bars ? usd(bars.at(-1)!.close) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CrossTable({ rows }: { rows: Row[] }) {
  const read = rows
    .map((row) => ({ ...row, reading: row.bars && crossReading(row.bars) }))
    .sort((a, b) => (b.reading?.gapPct ?? -Infinity) - (a.reading?.gapPct ?? -Infinity));
  const golden = read.filter((row) => row.reading?.state === "golden").length;

  return (
    <>
      <Prose>
        {golden} of {read.length} coins are in a golden cross on the daily chart, their 50-day
        SMA above the 200-day; the rest are in a death cross.
      </Prose>
      <div className="overflow-x-auto">
        <table className="w-full max-w-2xl whitespace-nowrap text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className={HEAD}>Coin</th>
              <th className={HEAD}>Now</th>
              <th className={HEAD}>Since</th>
              <th className={`${HEAD} text-right`}>50 vs 200</th>
            </tr>
          </thead>
          <tbody>
            {read.map(({ pair, reading }) => (
              <tr key={pair.id} className="border-t border-border">
                <CoinCell pair={pair} indicator="golden-cross" />
                <td className={CELL}>
                  {reading ? (reading.state === "golden" ? "Golden cross" : "Death cross") : "—"}
                </td>
                <td className={CELL}>
                  {reading?.crosses[0] ? chartDay(reading.crosses[0].time) : "—"}
                </td>
                <td className={`${CELL} text-right`}>{reading ? signedPct(reading.gapPct) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** One indicator's reading for every coin we chart, from daily bars. */
export default async function HubDetails({ indicator }: { indicator: HubId }) {
  const fetched = await Promise.all(PAIRS.map((pair) => fetchDailyBars(pair)));
  const rows: Row[] = PAIRS.map((pair, i) => ({ pair, bars: fetched[i]?.bars ?? null }));
  const at = Math.max(0, ...fetched.map((one) => one?.at ?? 0));
  const others = HUB_IDS.filter((id) => id !== indicator);

  return (
    <section
      aria-labelledby="hub-heading"
      className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 pt-4 pb-6 sm:px-4"
    >
      <h1 id="hub-heading" className="text-xl font-semibold text-foreground">
        {HUBS[indicator].heading}
      </h1>
      {indicator === "rsi" ? <RsiTable rows={rows} /> : <CrossTable rows={rows} />}
      {at > 0 && <Stamp at={at} chart={false} />}
      <nav aria-label="Every coin" className="flex flex-wrap gap-2">
        {others.map((id) => (
          <Link
            key={id}
            href={hubPath(id)}
            className="flex h-8 items-center rounded-md border border-border px-2.5 text-xs text-subtle-foreground transition hover:bg-secondary hover:text-foreground"
          >
            {HUBS[id].heading}
          </Link>
        ))}
      </nav>
    </section>
  );
}
