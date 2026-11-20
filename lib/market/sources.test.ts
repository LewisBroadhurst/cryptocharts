import { describe, expect, it } from "vitest";

import { pairFor, searchPairs } from "@/lib/market/pairs";
import {
  readCoinbaseRows,
  readKrakenBars,
  readKrakenOhlc,
  usableExchange,
} from "@/lib/market/sources";

// Shapes as the exchanges sent them to the Phase 0 probe (docs/phase-0.md).
describe("readCoinbaseRows", () => {
  it("turns newest-first [time, low, high, open, close, volume] rows into bars, oldest first", () => {
    const bars = readCoinbaseRows([
      [1795172160, 61900, 61990, 61950, 61980, 4.2],
      [1795172100, 61929.31, 61991.48, 61991.48, 61948.08, 5.47],
    ]);
    expect(bars).toEqual([
      { time: 1795172100, open: 61991.48, high: 61991.48, low: 61929.31, close: 61948.08, volume: 5.47 },
      { time: 1795172160, open: 61950, high: 61990, low: 61900, close: 61980, volume: 4.2 },
    ]);
  });

  it("refuses an error body", () => {
    expect(() => readCoinbaseRows({ message: "NotFound" })).toThrow();
  });
});

describe("readKrakenOhlc", () => {
  it("reads string rows under the pair's key", () => {
    const bars = readKrakenOhlc({
      error: [],
      result: {
        XXBTZUSD: [[1795172100, "61987.9", "61990.0", "61948.3", "61965.2", "61964.6", "0.909", 76]],
        last: 1795172040,
      },
    });
    expect(bars).toEqual([
      { time: 1795172100, open: 61987.9, high: 61990, low: 61948.3, close: 61965.2, volume: 0.909 },
    ]);
  });

  it("passes Kraken's own error on", () => {
    expect(() => readKrakenOhlc({ error: ["EQuery:Unknown asset pair"] })).toThrow(
      "EQuery:Unknown asset pair",
    );
  });
});

describe("readKrakenBars", () => {
  it("reads a v2 ohlc update", () => {
    const bars = readKrakenBars({
      channel: "ohlc",
      type: "update",
      data: [
        {
          symbol: "BTC/USD",
          open: 61987.9,
          high: 61987.9,
          low: 61948.3,
          close: 61965.2,
          volume: 0.90948083,
          interval_begin: "2026-11-20T10:55:00.000000000Z",
          interval: 1,
        },
      ],
    });
    expect(bars[0].time).toBe(Date.parse("2026-11-20T10:55:00Z") / 1000);
    expect(bars[0].close).toBe(61965.2);
  });

  it("ignores other channels", () => {
    expect(readKrakenBars({ channel: "heartbeat" })).toEqual([]);
  });
});

describe("usableExchange", () => {
  it("keeps a link to Kraken, and sends one to locked Coinbase or nowhere to Kraken", () => {
    expect(usableExchange("kraken")).toBe("kraken");
    expect(usableExchange("coinbase")).toBe("kraken");
    expect(usableExchange(undefined)).toBe("kraken");
    expect(usableExchange("binance")).toBe("kraken");
  });
});

describe("pairs", () => {
  it("falls back to Bitcoin for a pair we don't chart", () => {
    expect(pairFor("eth-usd").id).toBe("ETH-USD");
    expect(pairFor("<script>").id).toBe("BTC-USD");
    expect(pairFor(undefined).id).toBe("BTC-USD");
  });

  it("finds coins by symbol or name", () => {
    expect(searchPairs("sol").map((one) => one.id)).toEqual(["SOL-USD"]);
    expect(searchPairs("bitcoin").map((one) => one.id)).toEqual(["BTC-USD", "BCH-USD"]);
  });
});
