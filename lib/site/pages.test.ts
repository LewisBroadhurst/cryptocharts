import { describe, expect, it } from "vitest";

import { pairById, pairFor } from "@/lib/market/pairs";
import {
  chartPageForPath,
  chartPageHeading,
  chartPagePath,
  chartPreset,
  samePageFor,
  topicPages,
} from "@/lib/site/pages";
import { topicMetadata } from "@/lib/site/seo";

const BTC = pairFor("BTC-USD");
const ETH = pairFor("ETH-USD");

describe("indicator and backtest pages", () => {
  it("live under the coin's name, Bitcoin's included", () => {
    expect(topicPages().map(chartPagePath)).toEqual([
      "/bitcoin/rsi",
      "/bitcoin/200-day-moving-average",
      "/bitcoin/golden-cross",
      "/bitcoin/backtest/golden-cross",
      "/ethereum/rsi",
      "/ethereum/200-day-moving-average",
      "/ethereum/golden-cross",
      "/ethereum/backtest/golden-cross",
      "/solana/rsi",
      "/solana/200-day-moving-average",
      "/solana/golden-cross",
      "/solana/backtest/golden-cross",
    ]);
  });

  it("read back from their addresses, and nothing else does", () => {
    for (const page of topicPages()) expect(chartPageForPath(chartPagePath(page))).toEqual(page);
    expect(chartPageForPath("/")).toEqual({ kind: "coin", pair: BTC });
    expect(chartPageForPath("/ethereum")).toEqual({ kind: "coin", pair: ETH });
    for (const path of ["/bitcoin", "/dogecoin/rsi", "/bitcoin/macd", "/bitcoin/backtest/rsi", "/bitcoin/rsi/x", "/nope/rsi"])
      expect(chartPageForPath(path)).toBeUndefined();
  });

  it("open the chart daily, with the page's indicators", () => {
    const rsi = chartPreset({ kind: "indicator", pair: BTC, indicator: "rsi" })!;
    expect(rsi.interval).toBe("1D");
    expect(rsi.studies.map((study) => `${study.kind}${study.length}`)).toEqual(["rsi14"]);
    const backtest = chartPreset({ kind: "backtest", pair: BTC, strategy: "golden-cross" })!;
    expect(backtest.studies.map((study) => `${study.kind}${study.length}`)).toEqual(["sma50", "sma200"]);
    expect(backtest.script).toMatch(/ctx\.sma\(50\), ctx\.sma\(200\)/);
    expect(chartPreset({ kind: "coin", pair: BTC })).toBeUndefined();
  });

  it("send a coin pick to the same page for that coin, or its chart", () => {
    const page = { kind: "indicator", pair: BTC, indicator: "rsi" } as const;
    expect(chartPagePath(samePageFor(page, ETH))).toBe("/ethereum/rsi");
    expect(chartPagePath(samePageFor(page, pairById("DOGE-USD")!))).toBe("/dogecoin");
  });

  it("are titled in trading terms and point search engines at themselves", () => {
    const meta = topicMetadata({ kind: "indicator", pair: ETH, indicator: "200-day-moving-average" });
    expect(meta.title).toBe("Ethereum (ETH) 200-day moving average | Crypto Charts");
    expect(meta.alternates?.canonical).toBe("https://cryptocharts.stratdeck.uk/ethereum/200-day-moving-average");
    expect(chartPageHeading({ kind: "backtest", pair: BTC, strategy: "golden-cross" })).toBe(
      "Bitcoin (BTC) golden cross backtest",
    );
  });
});
