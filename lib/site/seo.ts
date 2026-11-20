import type { Metadata } from "next";

import { DEFAULT_PAIR, type Pair } from "@/lib/market/pairs";

export const SITE_URL = "https://cryptocharts.stratdeck.uk";
export const SITE_NAME = "Crypto Charts";

/** Where a share image measures, for the page's tags and the image itself. */
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** "Ethereum (ETH)", or just "XRP" where the name is the symbol. */
export const coinLabel = (pair: Pair): string =>
  pair.name === pair.base ? pair.name : `${pair.name} (${pair.base})`;

/** The one address search engines should keep for a pair's chart: Bitcoin,
    the chart the site opens on, lives at the root. */
export const pairUrl = (pair: Pair): string =>
  pair.id === DEFAULT_PAIR ? `${SITE_URL}/` : `${SITE_URL}/?pair=${pair.id}`;

export const shareImagePath = (pair: Pair): string => `/og/${pair.id}`;

export const shareImageAlt = (pair: Pair): string =>
  `${coinLabel(pair)} live price chart on ${SITE_NAME}`;

/** Title, description, canonical address and share card for a pair's page. */
export function pairMetadata(pair: Pair): Metadata {
  const label = coinLabel(pair);
  const title = `${label} live price chart | ${SITE_NAME}`;
  const description = `Live ${pair.base}/USD chart with drawing tools, indicators, bar replay and Python backtests. Free, no sign-up.`;
  const url = pairUrl(pair);
  const image = {
    url: shareImagePath(pair),
    ...SHARE_IMAGE_SIZE,
    alt: shareImageAlt(pair),
    type: "image/png",
  };

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_GB",
      url,
      title,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
