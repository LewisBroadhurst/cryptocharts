import type { Metadata } from "next";
import { notFound } from "next/navigation";

import HubDetails from "@/components/site/HubDetails";
import { HUB_IDS, type HubId } from "@/lib/site/pages";
import { hubMetadata } from "@/lib/site/seo";

// Built once, then again at most every 15 minutes.
export const revalidate = 900;

export const dynamicParams = false;

export function generateStaticParams() {
  return HUB_IDS.map((indicator) => ({ indicator }));
}

type Props = { params: Promise<{ indicator: string }> };

const isHub = (value: string): value is HubId => HUB_IDS.includes(value as HubId);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { indicator } = await params;
  return isHub(indicator) ? hubMetadata(indicator) : {};
}

/** One indicator's reading for every coin we chart. */
export default async function HubPage({ params }: Props) {
  const { indicator } = await params;
  if (!isHub(indicator)) notFound();
  return <HubDetails indicator={indicator} />;
}
