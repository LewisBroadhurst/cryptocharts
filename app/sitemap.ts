import type { MetadataRoute } from "next";

import { PAIRS } from "@/lib/market/pairs";
import { HUB_IDS, topicPages } from "@/lib/site/pages";
import { chartPageUrl, hubUrl, pairUrl } from "@/lib/site/seo";

/** The home page (Bitcoin's chart), each other pair's chart, the indicator and
    backtest pages, and the pages listing every coin's reading. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...PAIRS.map((pair) => ({
      url: pairUrl(pair),
      changeFrequency: "daily" as const,
      priority: pairUrl(pair).endsWith("/") ? 1 : 0.8,
    })),
    ...HUB_IDS.map((id) => ({
      url: hubUrl(id),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...topicPages().map((page) => ({
      url: chartPageUrl(page),
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
