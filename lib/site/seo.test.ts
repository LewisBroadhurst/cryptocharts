import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { PAIRS, pairFor } from "@/lib/market/pairs";
import { legacyRedirects } from "@/lib/site/legacy-redirects";
import { pairMetadata, pairPath, pairStructuredData, pairUrl } from "@/lib/site/seo";

const SITE = "https://cryptocharts.stratdeck.uk";

describe("pairMetadata", () => {
  it("names Ethereum, says what the reader gets and points at its own page", () => {
    const meta = pairMetadata(pairFor("ETH-USD"));
    expect(meta.title).toBe("Ethereum (ETH) live price chart | Crypto Charts");
    expect(meta.description).toMatch(/^Live ETH\/USD chart/);
    expect(meta.description).toMatch(/drawing tools, indicators, bar replay and Python backtests/);
    expect(meta.alternates?.canonical).toBe(`${SITE}/ethereum`);
    expect(meta.openGraph).toMatchObject({
      url: `${SITE}/ethereum`,
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
        expect(meta.alternates?.canonical).toBe(`${SITE}/dogecoin`);
      } else {
        expect(meta.alternates?.canonical).toBe(`${SITE}/`);
        expect(meta.title).toMatch(/^Bitcoin \(BTC\)/);
      }
    }
  });

  it("canonicalises a lower-case pair and doesn't repeat a symbol that is the name", () => {
    expect(pairMetadata(pairFor("sol-usd")).alternates?.canonical).toBe(`${SITE}/solana`);
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
    expect(urls).toContain(`${SITE}/ethereum`);
    expect(urls).toContain(`${SITE}/bitcoin-cash`);
    expect(urls).not.toContain(`${SITE}/bitcoin`);
    expect(urls).toHaveLength(PAIRS.length);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toEqual(PAIRS.map(pairUrl));
  });
});

describe("each coin's page", () => {
  it("lives at its name, with Bitcoin at home", () => {
    expect(PAIRS.map(pairPath)).toEqual([
      "/",
      "/ethereum",
      "/solana",
      "/xrp",
      "/dogecoin",
      "/cardano",
      "/avalanche",
      "/chainlink",
      "/polkadot",
      "/litecoin",
      "/bitcoin-cash",
      "/stellar",
      "/uniswap",
      "/aave",
    ]);
  });

  it("says what the coin is, in a line or two that makes no buy or price talk", () => {
    for (const pair of PAIRS) {
      expect(pair.about).toMatch(new RegExp(pair.name));
      expect(pair.about.length).toBeLessThan(200);
      expect(pair.about).not.toMatch(/\b(buy|sell|invest|price target|profit)/i);
    }
  });

  it("tells search engines it's the coin's chart page, inside the site", () => {
    type Crumbs = { itemListElement: { item: string }[] };
    const [page, crumbs] = pairStructuredData(pairFor("ETH-USD"))["@graph"] as [unknown, Crumbs];
    expect(page).toMatchObject({
      "@type": "WebPage",
      url: `${SITE}/ethereum`,
      name: "Ethereum (ETH) live chart",
      about: { name: "Ethereum", alternateName: "ETH" },
      isPartOf: { url: `${SITE}/` },
    });
    expect(crumbs.itemListElement.map((one) => one.item)).toEqual([
      `${SITE}/`,
      `${SITE}/ethereum`,
    ]);
    const [, home] = pairStructuredData(pairFor("BTC-USD"))["@graph"] as [unknown, Crumbs];
    expect(home.itemListElement).toHaveLength(1);
  });
});

describe("old chart links", () => {
  const redirects = legacyRedirects();
  const match = (pairParam: string) =>
    redirects.find(
      (one) =>
        one.source === "/" &&
        one.has?.some((has) => new RegExp(`^(?:${has.value})$`).test(pairParam)),
    );

  it("send `/?pair=` to the coin's page for good, however the pair is written", () => {
    expect(match("ETH-USD")).toMatchObject({ destination: "/ethereum", permanent: true });
    expect(match("eth-usd")?.destination).toBe("/ethereum");
    expect(match("Bch-Usd")?.destination).toBe("/bitcoin-cash");
  });

  it("leave Bitcoin, and pairs we don't chart, on the home page", () => {
    expect(match("BTC-USD")).toBeUndefined();
    expect(match("NOPE-USD")).toBeUndefined();
    expect(match("ETH-USDT")).toBeUndefined();
  });

  it("send /bitcoin home", () => {
    expect(redirects).toContainEqual({ source: "/bitcoin", destination: "/", permanent: true });
  });
});

describe("robots", () => {
  it("allows crawling, keeps out the sandbox and Python, and names the sitemap", () => {
    const { rules, sitemap: map } = robots();
    expect(rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/sandbox", "/pyodide/"] });
    expect(map).toBe(`${SITE}/sitemap.xml`);
  });
});
