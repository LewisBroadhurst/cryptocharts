import { afterEach, describe, expect, it, vi } from "vitest";

import { pairFor } from "@/lib/market/pairs";
import { coinAmount, fetchSnapshot, readKrakenTicker, usd } from "@/lib/market/snapshot";

const AT = Date.parse("2026-11-20T14:05:00Z");

// Kraken's Ticker answer, keyed by its own name for the pair.
const TICKER = {
  error: [],
  result: {
    XXBTZUSD: {
      a: ["97010.1", "1", "1.000"],
      b: ["97010.0", "2", "2.000"],
      c: ["97010.0", "0.0012"],
      v: ["812.4", "2441.79"],
      p: ["96500.2", "96021.3"],
      t: [21345, 60123],
      l: ["95000.0", "94100.5"],
      h: ["97500.0", "97999.9"],
      o: "95000.0",
    },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readKrakenTicker", () => {
  it("takes the last price, today's move and the last 24 hours' range and volume", () => {
    expect(readKrakenTicker(TICKER, AT)).toEqual({
      price: 97010,
      changeToday: ((97010 - 95000) / 95000) * 100,
      high24h: 97999.9,
      low24h: 94100.5,
      volume24h: 2441.79,
      at: AT,
    });
  });

  it("gives nothing for an error, an empty or odd answer, or a missing figure", () => {
    expect(readKrakenTicker({ error: ["EQuery:Unknown asset pair"], result: {} }, AT)).toBeNull();
    expect(readKrakenTicker({ error: [], result: {} }, AT)).toBeNull();
    expect(readKrakenTicker(null, AT)).toBeNull();
    expect(readKrakenTicker("nope", AT)).toBeNull();
    const noPrice = structuredClone(TICKER);
    noPrice.result.XXBTZUSD.c = [];
    expect(readKrakenTicker(noPrice, AT)).toBeNull();
    const zeroOpen = structuredClone(TICKER);
    zeroOpen.result.XXBTZUSD.o = "0";
    expect(readKrakenTicker(zeroOpen, AT)).toBeNull();
  });
});

describe("fetchSnapshot", () => {
  it("asks Kraken for the pair by its REST name", async () => {
    const fetch = vi.fn(async () => Response.json(TICKER));
    vi.stubGlobal("fetch", fetch);
    const snapshot = await fetchSnapshot(pairFor("BTC-USD"));
    expect(snapshot?.price).toBe(97010);
    expect(String(fetch.mock.calls[0]).split(",")[0]).toBe(
      "https://api.kraken.com/0/public/Ticker?pair=XBTUSD",
    );
  });

  it("tries once more after a refusal, such as a rate limit", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: ["EGeneral:Too many requests"] }))
      .mockResolvedValueOnce(Response.json(TICKER));
    vi.stubGlobal("fetch", fetch);
    expect((await fetchSnapshot(pairFor("BTC-USD"), 0))?.price).toBe(97010);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("gives nothing, rather than failing the page, when Kraken can't be reached or says no", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    expect(await fetchSnapshot(pairFor("ETH-USD"), 0)).toBeNull();
    const busy = vi.fn(async () => new Response("busy", { status: 503 }));
    vi.stubGlobal("fetch", busy);
    expect(await fetchSnapshot(pairFor("ETH-USD"), 0)).toBeNull();
    expect(busy).toHaveBeenCalledTimes(2);
  });
});

describe("the figures' formats", () => {
  it("writes cents for a coin worth a dollar or more, four places below", () => {
    expect(usd(97010)).toBe("$97,010.00");
    expect(usd(1.5)).toBe("$1.50");
    expect(usd(0.18341)).toBe("$0.1834");
  });

  it("writes a volume whole once it's large, with two places when small", () => {
    expect(coinAmount(2441.79, "BTC")).toBe("2,442 BTC");
    expect(coinAmount(12.5, "BTC")).toBe("12.5 BTC");
  });
});
