import { afterEach, describe, expect, it, vi } from "vitest";

import { SOURCES } from "@/lib/market/sources";
import { exchangeInAddress, workspaceSearch } from "@/components/charts/workspaceAddress";

const at = (search: string) => vi.stubGlobal("window", { location: { search } });

afterEach(() => {
  vi.unstubAllGlobals();
  SOURCES.coinbase.available = false;
});

describe("the chart's address", () => {
  it("drops an old link's pair and the default exchange, and keeps anything else", () => {
    at("?pair=ETH-USD&ex=kraken&utm_source=x");
    expect(workspaceSearch()).toBe("?utm_source=x");
    at("");
    expect(workspaceSearch()).toBe("");
  });

  it("names an exchange that isn't the default, once readers may pick it", () => {
    at("?ex=coinbase");
    expect(exchangeInAddress()).toBe("kraken");
    SOURCES.coinbase.available = true;
    expect(exchangeInAddress()).toBe("coinbase");
    expect(workspaceSearch()).toBe("?ex=coinbase");
    at("?pair=SOL-USD");
    expect(workspaceSearch("coinbase")).toBe("?ex=coinbase");
  });
});
