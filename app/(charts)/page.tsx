import type { Metadata } from "next";

import CoinDetails from "@/components/site/CoinDetails";
import { DEFAULT_PAIR, pairById } from "@/lib/market/pairs";
import { pairMetadata } from "@/lib/site/seo";

// Built once, then again at most every 15 minutes, for the figures under the chart.
export const revalidate = 900;

const BITCOIN = pairById(DEFAULT_PAIR)!;

export const metadata: Metadata = pairMetadata(BITCOIN);

/** The home page is Bitcoin's chart. */
export default function Home() {
  return <CoinDetails pair={BITCOIN} />;
}
