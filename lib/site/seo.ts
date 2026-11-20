import type { Metadata } from "next";

import { DEFAULT_PAIR, pairById, pairBySlug, type Pair } from "@/lib/market/pairs";

export const SITE_URL = "https://cryptocharts.stratdeck.uk";
export const SITE_NAME = "Crypto Charts";

/** Where a share image measures, for the page's tags and the image itself. */
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** "Ethereum (ETH)", or just "XRP" where the name is the symbol. */
export const coinLabel = (pair: Pair): string =>
  pair.name === pair.base ? pair.name : `${pair.name} (${pair.base})`;

/** A pair's page: Bitcoin, the chart the site opens on, is the home page;
    every other coin has its own, `/ethereum`. */
export const pairPath = (pair: Pair): string =>
  pair.id === DEFAULT_PAIR ? "/" : `/${pair.slug}`;

/** The pair whose page is at `pathname`, or undefined for any other page. */
export function pairForPath(pathname: string): Pair | undefined {
  if (pathname === "/") return pairById(DEFAULT_PAIR);
  const pair = pairBySlug(pathname.slice(1));
  return pair && pair.id !== DEFAULT_PAIR ? pair : undefined;
}

/** The one address search engines should keep for a pair's chart. */
export const pairUrl = (pair: Pair): string => `${SITE_URL}${pairPath(pair)}`;

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

/** What a search engine reads about the page beyond its tags: a chart page
    about the coin, inside the site. */
export function pairStructuredData(pair: Pair) {
  const url = pairUrl(pair);
  const home = `${SITE_URL}/`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: `${coinLabel(pair)} live chart`,
        description: pair.about,
        inLanguage: "en-GB",
        isPartOf: { "@type": "WebSite", "@id": home, url: home, name: SITE_NAME },
        about: { "@type": "Thing", name: pair.name, alternateName: pair.base },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: `${SITE_URL}${shareImagePath(pair)}`,
          width: SHARE_IMAGE_SIZE.width,
          height: SHARE_IMAGE_SIZE.height,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: home },
          ...(url === home
            ? []
            : [{ "@type": "ListItem", position: 2, name: pair.name, item: url }]),
        ],
      },
    ],
  };
}
