import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site/seo";

/** Crawl the charts; the backtest sandbox and Python's files are no pages. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/sandbox", "/pyodide/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
