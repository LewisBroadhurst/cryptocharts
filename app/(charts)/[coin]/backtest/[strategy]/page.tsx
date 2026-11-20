import type { Metadata } from "next";
import { notFound } from "next/navigation";

import BacktestDetails from "@/components/site/BacktestDetails";
import { chartPageForPath, topicPages } from "@/lib/site/pages";
import { topicMetadata } from "@/lib/site/seo";

// Built once, then again at most every 15 minutes, for the results under the chart.
export const revalidate = 900;

// One page per strategy for each coin in the first batch; any other address
// is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return topicPages()
    .filter((page) => page.kind === "backtest")
    .map((page) => ({ coin: page.pair.slug, strategy: page.strategy }));
}

type Props = { params: Promise<{ coin: string; strategy: string }> };

async function pageFor(params: Props["params"]) {
  const { coin, strategy } = await params;
  const page = chartPageForPath(`/${coin}/backtest/${strategy}`);
  return page?.kind === "backtest" ? page : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await pageFor(params);
  return page ? topicMetadata(page) : {};
}

export default async function StrategyPage({ params }: Props) {
  const page = await pageFor(params);
  if (!page) notFound();
  return <BacktestDetails pair={page.pair} strategy={page.strategy} />;
}
