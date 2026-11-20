// next.config.ts loads this file before the `@/` alias exists, so its imports
// are relative.
import { DEFAULT_PAIR, PAIRS, pairById } from "../market/pairs";

type Redirect = {
  source: string;
  has?: { type: "query"; key: string; value: string }[];
  destination: string;
  permanent: boolean;
};

/** Any spelling of the pair's id, for matching an old `?pair=` link. */
const anyCase = (text: string): string =>
  [...text]
    .map((c) => (/[a-z]/i.test(c) ? `[${c.toUpperCase()}${c.toLowerCase()}]` : c))
    .join("");

/** Before each coin had a page, a chart's link was `/?pair=ETH-USD`. Those
    links, shared or indexed, go to the coin's page for good. The query rides
    along (Next keeps it), and the chart drops `pair` from the address. Bitcoin's
    page is the home page itself, so it needs none; `/bitcoin` goes home. */
export function legacyRedirects(): Redirect[] {
  return [
    ...PAIRS.filter((pair) => pair.id !== DEFAULT_PAIR).map((pair): Redirect => ({
      source: "/",
      has: [{ type: "query", key: "pair", value: anyCase(pair.id) }],
      destination: `/${pair.slug}`,
      permanent: true,
    })),
    { source: `/${pairById(DEFAULT_PAIR)!.slug}`, destination: "/", permanent: true },
  ];
}
