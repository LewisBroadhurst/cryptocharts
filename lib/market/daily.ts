import type { Candle } from "@/lib/data/chart-data";
import type { Pair } from "@/lib/market/pairs";
import { readKrakenOhlc } from "@/lib/market/sources";

/** A build or a refresh asks for the same coin's bars from several pages at
    once; one answer serves them all for this long. */
const KEEP_MS = 60_000;
const asked = new Map<string, { at: number; bars: Promise<DailyBars | null> }>();

/** A coin's daily bars, and when they were fetched (epoch ms). */
export type DailyBars = { bars: Candle[]; at: number };

async function askKraken(pair: Pair): Promise<DailyBars | null> {
  try {
    const response = await fetch(
      `https://api.kraken.com/0/public/OHLC?pair=${pair.kraken.rest}&interval=1440`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) return null;
    const bars = readKrakenOhlc(await response.json());
    return bars.length > 0 ? { bars, at: Date.now() } : null;
  } catch {
    return null;
  }
}

async function fetchFresh(
  pair: Pair,
  retryAfterMs: number,
  building: boolean,
): Promise<DailyBars | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0)
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs * attempt));
    const bars = await askKraken(pair);
    if (bars) return bars;
  }
  if (building) return null;
  throw new Error(`Kraken's daily bars for ${pair.id} couldn't be reached`);
}

/**
 * The coin's daily bars from Kraken, oldest first: its newest 720, about two
 * years, the last of them today's, still open. As with the ticker, a build
 * goes without them if Kraken can't be reached, and a refresh of a live page
 * throws, so Next keeps the page it has.
 */
export function fetchDailyBars(
  pair: Pair,
  retryAfterMs = 1_000,
  building = process.env.NEXT_PHASE === "phase-production-build",
): Promise<DailyBars | null> {
  const now = Date.now();
  const kept = asked.get(pair.id);
  if (kept && now - kept.at < KEEP_MS) return kept.bars;
  const bars = fetchFresh(pair, retryAfterMs, building);
  asked.set(pair.id, { at: now, bars });
  // A failure isn't kept: the next page asks again.
  bars.catch(() => asked.delete(pair.id));
  return bars;
}
