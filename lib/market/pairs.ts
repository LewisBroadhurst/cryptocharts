export type Pair = {
  /** Our id, in the URL: `BTC-USD`. */
  id: string;
  base: string;
  name: string;
  /** Coinbase Exchange product id. */
  coinbase: string;
  /** Kraken REST pair name (altname) and WebSocket v2 symbol. */
  kraken: { rest: string; ws: string };
};

const pair = (
  base: string,
  name: string,
  krakenRest: string,
): Pair => ({
  id: `${base}-USD`,
  base,
  name,
  coinbase: `${base}-USD`,
  kraken: { rest: krakenRest, ws: `${base}/USD` },
});

export const PAIRS: readonly Pair[] = [
  pair("BTC", "Bitcoin", "XBTUSD"),
  pair("ETH", "Ethereum", "ETHUSD"),
  pair("SOL", "Solana", "SOLUSD"),
  pair("XRP", "XRP", "XRPUSD"),
  pair("DOGE", "Dogecoin", "XDGUSD"),
  pair("ADA", "Cardano", "ADAUSD"),
  pair("AVAX", "Avalanche", "AVAXUSD"),
  pair("LINK", "Chainlink", "LINKUSD"),
  pair("DOT", "Polkadot", "DOTUSD"),
  pair("LTC", "Litecoin", "LTCUSD"),
  pair("BCH", "Bitcoin Cash", "BCHUSD"),
  pair("XLM", "Stellar", "XLMUSD"),
  pair("UNI", "Uniswap", "UNIUSD"),
  pair("AAVE", "Aave", "AAVEUSD"),
];

export const DEFAULT_PAIR = "BTC-USD";

export const pairById = (id: string): Pair | undefined =>
  PAIRS.find((one) => one.id === id.toUpperCase());

/** The pair a URL asks for, or Bitcoin when it asks for none we chart. */
export function pairFor(asked: string | string[] | undefined): Pair {
  const one = Array.isArray(asked) ? asked[0] : asked;
  return (one && pairById(one)) || pairById(DEFAULT_PAIR)!;
}

export function searchPairs(query: string): Pair[] {
  const q = query.trim().toUpperCase();
  if (!q) return [...PAIRS];
  return PAIRS.filter(
    (one) =>
      one.base.startsWith(q) ||
      one.id.startsWith(q) ||
      one.name.toUpperCase().includes(q),
  );
}
