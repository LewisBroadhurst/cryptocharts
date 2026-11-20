export type Pair = {
  /** Our id, in the URL: `BTC-USD`. */
  id: string;
  base: string;
  name: string;
  /** Coinbase Exchange product id. */
  coinbase: string;
  /** Kraken REST pair name (altname) and WebSocket v2 symbol. */
  kraken: { rest: string; ws: string };
  /** Its page's address: `/ethereum`. Bitcoin's chart is the home page. */
  slug: string;
  /** A line or two on what the coin is, for its page. */
  about: string;
};

const pair = (
  base: string,
  name: string,
  krakenRest: string,
  about: string,
): Pair => ({
  id: `${base}-USD`,
  base,
  name,
  coinbase: `${base}-USD`,
  kraken: { rest: krakenRest, ws: `${base}/USD` },
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  about,
});

export const PAIRS: readonly Pair[] = [
  pair(
    "BTC",
    "Bitcoin",
    "XBTUSD",
    "Bitcoin is the first cryptocurrency, launched in 2009: a fixed supply of 21 million coins moved on a public ledger that no single party runs.",
  ),
  pair(
    "ETH",
    "Ethereum",
    "ETHUSD",
    "Ethereum is a blockchain that runs programs called smart contracts. ETH pays for the computing and is staked to secure the network.",
  ),
  pair(
    "SOL",
    "Solana",
    "SOLUSD",
    "Solana is a blockchain built for fast, cheap transactions, used for trading, payments and apps. SOL pays its fees and is staked to secure it.",
  ),
  pair(
    "XRP",
    "XRP",
    "XRPUSD",
    "XRP is the native coin of the XRP Ledger, a network for settling payments in seconds, developed alongside the company Ripple.",
  ),
  pair(
    "DOGE",
    "Dogecoin",
    "XDGUSD",
    "Dogecoin began in 2013 as a joke on a meme and became one of the most traded coins. Unlike Bitcoin, its supply has no cap.",
  ),
  pair(
    "ADA",
    "Cardano",
    "ADAUSD",
    "Cardano is a proof-of-stake blockchain developed through peer-reviewed research. ADA pays its fees and is staked to secure it.",
  ),
  pair(
    "AVAX",
    "Avalanche",
    "AVAXUSD",
    "Avalanche is a platform of linked blockchains for apps and custom networks. AVAX pays its fees and is staked by its validators.",
  ),
  pair(
    "LINK",
    "Chainlink",
    "LINKUSD",
    "Chainlink feeds outside data, such as prices, to smart contracts on other blockchains. LINK pays the nodes that supply it.",
  ),
  pair(
    "DOT",
    "Polkadot",
    "DOTUSD",
    "Polkadot connects separate blockchains so they can share security and pass messages. DOT is staked to secure it and used to vote on changes.",
  ),
  pair(
    "LTC",
    "Litecoin",
    "LTCUSD",
    "Litecoin is one of the oldest cryptocurrencies, a 2011 fork of Bitcoin's code with faster blocks and a cap of 84 million coins.",
  ),
  pair(
    "BCH",
    "Bitcoin Cash",
    "BCHUSD",
    "Bitcoin Cash split from Bitcoin in 2017 to allow larger blocks, so more payments fit in each one. Its supply is capped at 21 million.",
  ),
  pair(
    "XLM",
    "Stellar",
    "XLMUSD",
    "Stellar is a network for moving money across borders and issuing digital versions of currencies. XLM pays its small transaction fees.",
  ),
  pair(
    "UNI",
    "Uniswap",
    "UNIUSD",
    "Uniswap is an exchange that runs on Ethereum smart contracts rather than through a company. UNI is its governance token.",
  ),
  pair(
    "AAVE",
    "Aave",
    "AAVEUSD",
    "Aave is a lending market run by smart contracts: deposit crypto to earn interest, or borrow against it. AAVE is its governance token.",
  ),
];

export const DEFAULT_PAIR = "BTC-USD";

/** The pair whose page is at `/{slug}`. */
export const pairBySlug = (slug: string): Pair | undefined =>
  PAIRS.find((one) => one.slug === slug);

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
