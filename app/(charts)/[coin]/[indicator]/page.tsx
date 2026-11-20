import type { Metadata } from "next";
import { notFound } from "next/navigation";

import IndicatorDetails from "@/components/site/IndicatorDetails";
import { chartPageForPath, topicPages } from "@/lib/site/pages";
import { topicMetadata } from "@/lib/site/seo";

// Built once, then again at most every 15 minutes, for the reading under the chart.
export const revalidate = 900;

// One page per indicator for each coin in the first batch; any other address
// is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return topicPages()
    .filter((page) => page.kind === "indicator")
    .map((page) => ({ coin: page.pair.slug, indicator: page.indicator }));
}

type Props = { params: Promise<{ coin: string; indicator: string }> };

async function pageFor(params: Props["params"]) {
  const { coin, indicator } = await params;
  const page = chartPageForPath(`/${coin}/${indicator}`);
  return page?.kind === "indicator" ? page : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await pageFor(params);
  return page ? topicMetadata(page) : {};
}

export default async function IndicatorPage({ params }: Props) {
  const page = await pageFor(params);
  if (!page) notFound();
  return <IndicatorDetails pair={page.pair} indicator={page.indicator} />;
}
