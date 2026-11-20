import type { Pair } from "@/lib/market/pairs";

/** A coin's figures as Kraken gave them when its page was last built. */
export type Snapshot = {
  price: number;
  /** Since 00:00 UTC, as a percentage. */
  changeToday: number;
  high24h: number;
  low24h: number;
  /** In the coin itself, not dollars. */
  volume24h: number;
  /** When the figures were fetched, epoch ms. */
  at: number;
};

const finite = (value: unknown): number | null => {
  const n = typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Kraken's Ticker answer for one pair, or null for anything else. Kraken
    keys the result by its own name for the pair, so the one entry is taken. */
export function readKrakenTicker(body: unknown, at: number): Snapshot | null {
  if (typeof body !== "object" || body === null) return null;
  const { error, result } = body as { error?: unknown; result?: unknown };
  if (Array.isArray(error) && error.length > 0) return null;
  if (typeof result !== "object" || result === null) return null;
  const entries = Object.values(result);
  if (entries.length !== 1) return null;
  const ticker = entries[0] as Record<string, unknown>;
  const pick = (key: string, index: number) => {
    const field = ticker[key];
    return Array.isArray(field) ? finite(field[index]) : null;
  };

  const price = pick("c", 0);
  const open = finite(ticker.o);
  const high24h = pick("h", 1);
  const low24h = pick("l", 1);
  const volume24h = pick("v", 1);
  if (
    price === null ||
    open === null ||
    open <= 0 ||
    high24h === null ||
    low24h === null ||
    volume24h === null
  )
    return null;

  return {
    price,
    changeToday: ((price - open) / open) * 100,
    high24h,
    low24h,
    volume24h,
    at,
  };
}

async function askKraken(pair: Pair): Promise<Snapshot | null> {
  try {
    const response = await fetch(
      `https://api.kraken.com/0/public/Ticker?pair=${pair.kraken.rest}`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (!response.ok) return null;
    return readKrakenTicker(await response.json(), Date.now());
  } catch {
    return null;
  }
}

/** The coin's figures from Kraken. A build asks for every coin at once, so a
    refusal (a rate limit, say) gets one more try. If Kraken still can't be
    reached, a build goes without the figures rather than failing; a refresh of
    a live page throws instead, so Next keeps the page it has, figures and all. */
export async function fetchSnapshot(
  pair: Pair,
  retryAfterMs = 1_000,
  building = process.env.NEXT_PHASE === "phase-production-build",
): Promise<Snapshot | null> {
  const first = await askKraken(pair);
  if (first) return first;
  await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
  const second = await askKraken(pair);
  if (second || building) return second;
  throw new Error(`Kraken's ticker for ${pair.id} couldn't be reached`);
}

const USD = new Map<number, Intl.NumberFormat>();

/** "$97,123.40", "$0.1834": cents for a coin worth a dollar or more, four
    places for one worth less. */
export function usd(value: number): string {
  const digits = Math.abs(value) >= 1 ? 2 : 4;
  let format = USD.get(digits);
  if (!format) {
    format = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    USD.set(digits, format);
  }
  return format.format(value);
}

const WHOLE = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const TWO = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

/** "1,234 BTC"; a small volume keeps two places: "12.5 BTC". */
export const coinAmount = (value: number, base: string): string =>
  `${(Math.abs(value) >= 100 ? WHOLE : TWO).format(value)} ${base}`;
