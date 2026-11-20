import { intervalSeconds, type Interval } from "@/lib/charts/bars";
import type { Candle } from "@/lib/data/chart-data";
import { aggregate, bucketStart, type Trade } from "@/lib/market/buckets";
import type { Pair } from "@/lib/market/pairs";

export type Exchange = "coinbase" | "kraken";

export type LiveUpdate = { bar: Candle } | { trade: Trade };
export type LiveStatus = "connecting" | "live" | "reconnecting";

export type MarketSource = {
  exchange: Exchange;
  /** Who the data comes from, as the credit on every chart names it. */
  label: string;
  url: string;
  /** Whether older bars can be fetched page by page as a reader scrolls back. */
  pagesBack: boolean;
  /** Bars oldest first, all starting before `before` (or up to now). */
  history(
    pair: Pair,
    interval: Interval,
    before?: number,
    signal?: AbortSignal,
  ): Promise<Candle[]>;
  /** Streams updates to the newest bar. Returns a function that stops it. */
  live(
    pair: Pair,
    interval: Interval,
    onUpdate: (update: LiveUpdate) => void,
    onStatus: (status: LiveStatus) => void,
  ): () => void;
};

const now = () => Math.floor(Date.now() / 1000);

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (problem) {
    if (signal?.aborted) throw problem;
    // A network that blocks the exchange looks like this, not like an error page.
    throw new Error("your connection couldn't reach the exchange");
  }
  if (!res.ok) throw new Error(`The exchange answered ${res.status}`);
  return res.json();
}

/**
 * A WebSocket that reopens itself, waiting longer each time, until stopped.
 * `onStatus("live")` after a reopen is the cue to refetch the newest bars.
 */
function keepOpen(
  url: string,
  subscribe: readonly unknown[],
  onMessage: (message: Record<string, unknown>) => void,
  onStatus: (status: LiveStatus) => void,
): () => void {
  let socket: WebSocket | null = null;
  let stopped = false;
  let tries = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const open = () => {
    onStatus(tries === 0 ? "connecting" : "reconnecting");
    socket = new WebSocket(url);
    socket.onopen = () => {
      for (const one of subscribe) socket?.send(JSON.stringify(one));
    };
    socket.onmessage = (event) => {
      let message: unknown;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (typeof message !== "object" || message === null) return;
      if (tries !== -1) {
        tries = -1;
        onStatus("live");
      }
      onMessage(message as Record<string, unknown>);
    };
    socket.onclose = () => {
      if (stopped) return;
      tries = Math.max(tries, 0) + 1;
      onStatus("reconnecting");
      timer = setTimeout(open, Math.min(30_000, 1_000 * 2 ** (tries - 1)));
    };
  };
  open();
  return () => {
    stopped = true;
    clearTimeout(timer);
    socket?.close();
  };
}

// ---- Coinbase Exchange ---------------------------------------------------

const COINBASE_REST = "https://api.exchange.coinbase.com";
const COINBASE_WS = "wss://ws-feed.exchange.coinbase.com";
const COINBASE_PAGE = 300;
/** Granularities Coinbase serves; 4h and 1W are built from 1h and 1D bars. */
const COINBASE_BASE: Record<Interval, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3_600,
  "4h": 3_600,
  "1D": 86_400,
  "1W": 86_400,
};
/** How many bars a first load or a scroll back fetches. */
const WANT_BARS = 500;
const MAX_PAGES = 10;

/** Coinbase rows are [time, low, high, open, close, volume], newest first. */
export function readCoinbaseRows(rows: unknown): Candle[] {
  if (!Array.isArray(rows)) throw new Error("Coinbase sent no bars");
  return rows
    .filter((row): row is number[] => Array.isArray(row) && row.length >= 6)
    .map(([time, low, high, open, close, volume]) => ({
      time,
      open,
      high,
      low,
      close,
      volume,
    }))
    .reverse();
}

export const coinbase: MarketSource = {
  exchange: "coinbase",
  label: "Coinbase",
  url: "https://www.coinbase.com",
  pagesBack: true,
  async history(pair, interval, before, signal) {
    const target = intervalSeconds(interval);
    const base = COINBASE_BASE[interval];
    const end = before ?? now() + base;
    const start = bucketStart(end - WANT_BARS * target, target);
    const windows: [number, number][] = [];
    for (let to = end; to > start && windows.length < MAX_PAGES; ) {
      const from = Math.max(start, to - COINBASE_PAGE * base);
      windows.push([from, to - base]);
      to = from;
    }
    const pages = await Promise.all(
      windows.map(([from, to]) =>
        getJson(
          `${COINBASE_REST}/products/${pair.coinbase}/candles?granularity=${base}` +
            `&start=${new Date(from * 1000).toISOString()}&end=${new Date(to * 1000).toISOString()}`,
          signal,
        ).then(readCoinbaseRows),
      ),
    );
    const bars = new Map<number, Candle>();
    for (const page of pages) for (const bar of page) bars.set(bar.time, bar);
    const sorted = [...bars.values()]
      .filter((bar) => bar.time < end)
      .sort((a, b) => a.time - b.time);
    return base === target ? sorted : aggregate(sorted, target);
  },
  live(pair, _interval, onUpdate, onStatus) {
    return keepOpen(
      COINBASE_WS,
      [{ type: "subscribe", product_ids: [pair.coinbase], channels: ["matches"] }],
      (message) => {
        if (message.type !== "match" && message.type !== "last_match") return;
        const time = Date.parse(String(message.time)) / 1000;
        const price = Number(message.price);
        const size = Number(message.size);
        if (Number.isFinite(time) && Number.isFinite(price))
          onUpdate({ trade: { time, price, size: Number.isFinite(size) ? size : 0 } });
      },
      onStatus,
    );
  },
};

// ---- Kraken -------------------------------------------------------------

const KRAKEN_REST = "https://api.kraken.com/0/public";
const KRAKEN_WS = "wss://ws.kraken.com/v2";
const KRAKEN_MINUTES: Record<Interval, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1D": 1_440,
  "1W": 10_080,
};

/** Kraken rows are [time, open, high, low, close, vwap, volume, count], as strings. */
export function readKrakenOhlc(body: unknown): Candle[] {
  const record = body as { error?: string[]; result?: Record<string, unknown> };
  if (record?.error?.length) throw new Error(`Kraken: ${record.error.join(", ")}`);
  const key = Object.keys(record?.result ?? {}).find((one) => one !== "last");
  const rows = key ? record.result![key] : null;
  if (!Array.isArray(rows)) throw new Error("Kraken sent no bars");
  return rows
    .filter((row): row is unknown[] => Array.isArray(row) && row.length >= 7)
    .map((row) => ({
      time: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[6]),
    }));
}

/** A Kraken v2 `ohlc` message's bars. */
export function readKrakenBars(message: Record<string, unknown>): Candle[] {
  if (message.channel !== "ohlc" || !Array.isArray(message.data)) return [];
  return (message.data as Record<string, unknown>[])
    .map((one) => ({
      time: Date.parse(String(one.interval_begin)) / 1000,
      open: Number(one.open),
      high: Number(one.high),
      low: Number(one.low),
      close: Number(one.close),
      volume: Number(one.volume),
    }))
    .filter((bar) => Number.isFinite(bar.time) && Number.isFinite(bar.close));
}

export const kraken: MarketSource = {
  exchange: "kraken",
  label: "Kraken",
  url: "https://www.kraken.com",
  // Kraken serves only its newest 720 bars, whatever `since` asks for.
  pagesBack: false,
  async history(pair, interval, before, signal) {
    if (before !== undefined) return [];
    const body = await getJson(
      `${KRAKEN_REST}/OHLC?pair=${pair.kraken.rest}&interval=${KRAKEN_MINUTES[interval]}`,
      signal,
    );
    return readKrakenOhlc(body);
  },
  live(pair, interval, onUpdate, onStatus) {
    return keepOpen(
      KRAKEN_WS,
      [
        {
          method: "subscribe",
          params: {
            channel: "ohlc",
            symbol: [pair.kraken.ws],
            interval: KRAKEN_MINUTES[interval],
          },
        },
      ],
      (message) => {
        for (const bar of readKrakenBars(message)) onUpdate({ bar });
      },
      onStatus,
    );
  },
};

export const SOURCES: Record<Exchange, MarketSource> = { coinbase, kraken };
export const DEFAULT_EXCHANGE: Exchange = "coinbase";
export const isExchange = (value: unknown): value is Exchange =>
  value === "coinbase" || value === "kraken";
