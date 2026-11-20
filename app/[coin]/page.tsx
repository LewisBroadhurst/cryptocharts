import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PairPage from "@/components/site/PairPage";
import { DEFAULT_PAIR, PAIRS, pairBySlug } from "@/lib/market/pairs";
import { pairMetadata } from "@/lib/site/seo";

// Built once, then again at most every 15 minutes, for the figures under the chart.
export const revalidate = 900;

// One page per coin we chart, other than Bitcoin, whose page is the home page;
// any other address is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return PAIRS.filter((pair) => pair.id !== DEFAULT_PAIR).map((pair) => ({ coin: pair.slug }));
}

type Props = { params: Promise<{ coin: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pair = pairBySlug((await params).coin);
  return pair ? pairMetadata(pair) : {};
}

export default async function CoinPage({ params }: Props) {
  const pair = pairBySlug((await params).coin);
  if (!pair || pair.id === DEFAULT_PAIR) notFound();
  return <PairPage pair={pair} />;
}
