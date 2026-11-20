import type { Metadata } from "next";

import type { Pair } from "@/lib/market/pairs";
import {
  chartPageForPath,
  chartPageHeading,
  chartPagePath,
  coinLabel,
  hubPath,
  pairPath,
  type ChartPage,
  type HubId,
  type IndicatorId,
} from "@/lib/site/pages";

export const SITE_URL = "https://cryptocharts.stratdeck.uk";
export const SITE_NAME = "Crypto Charts";

/** Where a share image measures, for the page's tags and the image itself. */
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export { coinLabel, pairPath };

/** The pair whose chart is at `pathname`, its own page or one of its
    indicator and backtest pages; undefined for any other page. */
export const pairForPath = (pathname: string): Pair | undefined =>
  chartPageForPath(pathname)?.pair;

/** The one address search engines should keep for a pair's chart. */
export const pairUrl = (pair: Pair): string => `${SITE_URL}${pairPath(pair)}`;

export const shareImagePath = (pair: Pair): string => `/og/${pair.id}`;

export const shareImageAlt = (pair: Pair): string =>
  `${coinLabel(pair)} live price chart on ${SITE_NAME}`;

function pageMetadata({
  title,
  description,
  url,
  image,
}: {
  title: string;
  description: string;
  url: string;
  image: { url: string; alt: string };
}): Metadata {
  const card = { ...image, ...SHARE_IMAGE_SIZE, type: "image/png" };
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
      images: [card],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [card],
    },
  };
}

/** Title, description, canonical address and share card for a pair's page. */
export function pairMetadata(pair: Pair): Metadata {
  return pageMetadata({
    title: `${coinLabel(pair)} live price chart | ${SITE_NAME}`,
    description: `Live ${pair.base}/USD chart with drawing tools, indicators, bar replay and Python backtests. Free, no sign-up.`,
    url: pairUrl(pair),
    image: { url: shareImagePath(pair), alt: shareImageAlt(pair) },
  });
}

export const chartPageUrl = (page: ChartPage): string =>
  page.kind === "coin" ? pairUrl(page.pair) : `${SITE_URL}${chartPagePath(page)}`;

const TOPIC_DESCRIPTIONS: Record<IndicatorId | "backtest", (pair: Pair) => string> = {
  rsi: (pair) =>
    `${pair.name}'s daily RSI 14, live, with overbought and oversold levels and the last time it reached each.`,
  "200-day-moving-average": (pair) =>
    `${pair.name}'s price against its 200-day moving average, live: how far above or below, and since when.`,
  "golden-cross": (pair) =>
    `${pair.name}'s 50-day and 200-day moving averages, live, with the date of every golden cross and death cross.`,
  backtest: (pair) =>
    `Golden cross backtest on ${pair.name}'s daily chart: return, max drawdown and win rate against holding. Edit the strategy in Python.`,
};

export const topicDescription = (page: Exclude<ChartPage, { kind: "coin" }>): string =>
  TOPIC_DESCRIPTIONS[page.kind === "indicator" ? page.indicator : "backtest"](page.pair);

/** Title, description, canonical address and share card for an indicator's or
    a strategy's page. The card is the coin's own. */
export function topicMetadata(page: Exclude<ChartPage, { kind: "coin" }>): Metadata {
  const heading = chartPageHeading(page);
  return pageMetadata({
    title: `${heading} | ${SITE_NAME}`,
    description: topicDescription(page),
    url: chartPageUrl(page),
    image: { url: shareImagePath(page.pair), alt: `${heading} on ${SITE_NAME}` },
  });
}

export const HUBS: Record<
  HubId,
  { heading: string; title: string; description: string }
> = {
  rsi: {
    heading: "Crypto RSI",
    title: "Crypto RSI: overbought and oversold coins",
    description:
      "Daily RSI 14 for Bitcoin, Ethereum, Solana and 11 more coins, sorted, with the overbought and oversold ones marked.",
  },
  "golden-cross": {
    heading: "Crypto golden crosses and death crosses",
    title: "Crypto golden crosses and death crosses",
    description:
      "Which coins are in a golden cross or a death cross on the daily chart, since when, and how wide the gap is.",
  },
};

export const hubUrl = (id: IndicatorId): string => `${SITE_URL}${hubPath(id)}`;

export function hubMetadata(id: HubId): Metadata {
  const hub = HUBS[id];
  return pageMetadata({
    title: `${hub.title} | ${SITE_NAME}`,
    description: hub.description,
    url: hubUrl(id),
    // No card of its own yet: Bitcoin's chart stands in.
    image: { url: "/og/BTC-USD", alt: hub.title },
  });
}

/** What a search engine reads about an indicator's or strategy's page: a page
    about the coin, under the coin's chart, inside the site. */
export function topicStructuredData(page: Exclude<ChartPage, { kind: "coin" }>) {
  const url = chartPageUrl(page);
  const home = `${SITE_URL}/`;
  const heading = chartPageHeading(page);
  const coinUrl = pairUrl(page.pair);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: heading,
        description: topicDescription(page),
        inLanguage: "en-GB",
        isPartOf: { "@type": "WebSite", "@id": home, url: home, name: SITE_NAME },
        about: { "@type": "Thing", name: page.pair.name, alternateName: page.pair.base },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: home },
          ...(coinUrl === home
            ? []
            : [{ "@type": "ListItem", position: 2, name: page.pair.name, item: coinUrl }]),
          {
            "@type": "ListItem",
            position: coinUrl === home ? 2 : 3,
            name: heading,
            item: url,
          },
        ],
      },
    ],
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
        name: `${coinLabel(pair)} live price chart`,
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
