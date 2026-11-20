import type { MetadataRoute } from "next";

import { PAIRS } from "@/lib/market/pairs";
import { pairUrl } from "@/lib/site/seo";

/** The home page (Bitcoin's chart) and each other pair's chart. */
export default function sitemap(): MetadataRoute.Sitemap {
  return PAIRS.map((pair) => ({
    url: pairUrl(pair),
    changeFrequency: "daily",
    priority: pairUrl(pair).endsWith("/") ? 1 : 0.8,
  }));
}
