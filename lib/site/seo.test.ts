import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { PAIRS, pairFor } from "@/lib/market/pairs";
import { pairMetadata, pairUrl } from "@/lib/site/seo";

const SITE = "https://cryptocharts.stratdeck.uk";

describe("pairMetadata", () => {
  it("names Ethereum, says what the reader gets and points at its own page", () => {
    const meta = pairMetadata(pairFor("ETH-USD"));
    expect(meta.title).toBe("Ethereum (ETH) live price chart | Crypto Charts");
    expect(meta.description).toMatch(/^Live ETH\/USD chart/);
    expect(meta.description).toMatch(/drawing tools, indicators, bar replay and Python backtests/);
    expect(meta.alternates?.canonical).toBe(`${SITE}/?pair=ETH-USD`);
    expect(meta.openGraph).toMatchObject({
      url: `${SITE}/?pair=ETH-USD`,
      siteName: "Crypto Charts",
      images: [{ url: "/og/ETH-USD", width: 1200, height: 630 }],
    });
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      images: [{ url: "/og/ETH-USD" }],
    });
  });

  it("keeps Bitcoin at the root", () => {
    const meta = pairMetadata(pairFor("BTC-USD"));
    expect(meta.title).toBe("Bitcoin (BTC) live price chart | Crypto Charts");
    expect(meta.alternates?.canonical).toBe(`${SITE}/`);
  });

  it("falls back to Bitcoin for a pair we don't chart, or none", () => {
    for (const asked of ["NOPE-USD", "", undefined, ["DOGE-USD", "x"]]) {
      const meta = pairMetadata(pairFor(asked));
      if (Array.isArray(asked)) {
        expect(meta.alternates?.canonical).toBe(`${SITE}/?pair=DOGE-USD`);
      } else {
        expect(meta.alternates?.canonical).toBe(`${SITE}/`);
        expect(meta.title).toMatch(/^Bitcoin \(BTC\)/);
      }
    }
  });

  it("canonicalises a lower-case pair and doesn't repeat a symbol that is the name", () => {
    expect(pairMetadata(pairFor("sol-usd")).alternates?.canonical).toBe(`${SITE}/?pair=SOL-USD`);
    expect(pairMetadata(pairFor("XRP-USD")).title).toBe("XRP live price chart | Crypto Charts");
  });

  it("gives every pair its own title, description, address and image", () => {
    const metas = PAIRS.map(pairMetadata);
    for (const field of ["title", "description"] as const) {
      expect(new Set(metas.map((m) => m[field])).size).toBe(PAIRS.length);
    }
    expect(new Set(metas.map((m) => m.alternates?.canonical)).size).toBe(PAIRS.length);
  });

  it("makes no buy or price talk", () => {
    for (const meta of PAIRS.map(pairMetadata)) {
      expect(`${meta.title} ${meta.description}`).not.toMatch(/\b(buy|sell|trade|invest|price target|profit)/i);
    }
  });
});

describe("sitemap", () => {
  it("lists the home page and each pair's page once", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain(`${SITE}/`);
    expect(urls).toContain(`${SITE}/?pair=ETH-USD`);
    expect(urls).not.toContain(`${SITE}/?pair=BTC-USD`);
    expect(urls).toHaveLength(PAIRS.length);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toEqual(PAIRS.map(pairUrl));
  });
});

describe("robots", () => {
  it("allows crawling, keeps out the sandbox and Python, and names the sitemap", () => {
    const { rules, sitemap: map } = robots();
    expect(rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/sandbox", "/pyodide/"] });
    expect(map).toBe(`${SITE}/sitemap.xml`);
  });
});
