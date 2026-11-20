// Calls the real exchanges, so it runs only with LIVE=1 (in CI, not on every test run).
import { describe, expect, it } from "vitest";

import { PAIRS } from "@/lib/market/pairs";
import { SOURCES, type LiveUpdate } from "@/lib/market/sources";

const live = process.env.LIVE === "1";

describe.skipIf(!live)("the exchanges, for real", () => {
  for (const source of Object.values(SOURCES)) {
    it(`${source.label} has history for every pair`, async () => {
      const missing: string[] = [];
      for (const pair of PAIRS) {
        const bars = await source.history(pair, "1h").catch(() => []);
        if (bars.length < 100) missing.push(`${pair.id} (${bars.length})`);
      }
      expect(missing).toEqual([]);
    }, 120_000);

    it(`${source.label} streams the newest bar`, async () => {
      const update = await new Promise<LiveUpdate>((resolve, reject) => {
        const timer = setTimeout(() => {
          stop();
          reject(new Error("nothing arrived in 30 s"));
        }, 30_000);
        const stop = source.live(
          PAIRS[0],
          "1m",
          (one) => {
            clearTimeout(timer);
            stop();
            resolve(one);
          },
          () => {},
        );
      });
      expect(update).toBeTruthy();
    }, 40_000);
  }

  it("Coinbase pages back for older bars", async () => {
    const newest = await SOURCES.coinbase.history(PAIRS[0], "1D");
    const older = await SOURCES.coinbase.history(PAIRS[0], "1D", newest[0].time);
    expect(older.length).toBeGreaterThan(100);
    expect(older.at(-1)!.time).toBeLessThan(newest[0].time);
  }, 60_000);
});
