// Holds the TypeScript golden cross to the Python engine's answers: a page's
// figures must be what "Open in backtester" shows.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ENGINE_PY } from "@/lib/backtest/engine";
import { GOLDEN_CROSS_STRATEGY, goldenCrossBacktest } from "@/lib/backtest/strategies";

const dir = mkdtempSync(path.join(tmpdir(), "strategies-"));
writeFileSync(path.join(dir, "engine.py"), ENGINE_PY);

function python(code: string, bars: object[], fee: number, slippage: number) {
  writeFileSync(path.join(dir, "input.json"), JSON.stringify({ code, bars, fee, slippage }));
  const out = execFileSync(
    "python3",
    [
      "-I",
      "-c",
      `import json, sys; sys.path.insert(0, ${JSON.stringify(dir)}); from engine import run_backtest; ` +
        `i = json.load(open(${JSON.stringify(path.join(dir, "input.json"))})); ` +
        `print(run_backtest(i["code"], json.dumps(i["bars"]), i["fee"], i["slippage"]))`,
    ],
    { encoding: "utf8", maxBuffer: 50_000_000 },
  );
  return JSON.parse(out);
}

/** Daily bars that swing up and down over months, so the averages cross a
    few times, with a trend under them. */
function swings(count: number) {
  let close = 100;
  return Array.from({ length: count }, (_, i) => {
    const open = close;
    close = Math.max(1, open * (1 + 0.03 * Math.sin(i / 37) + 0.004 * Math.sin(i / 3) + 0.0005));
    return {
      time: 1_600_000_000 + i * 86_400,
      open,
      high: Math.max(open, close) * 1.01,
      low: Math.min(open, close) * 0.99,
      close,
      volume: 1,
    };
  });
}

describe("the golden-cross backtest", () => {
  it("matches the Python engine trade for trade", () => {
    const bars = swings(720);
    const py = python(GOLDEN_CROSS_STRATEGY, bars, 0.1, 0.05);
    const ts = goldenCrossBacktest(bars, 0.1, 0.05)!;

    expect(py.ok).toBe(true);
    expect(py.trades.length).toBeGreaterThan(1);
    expect(ts.trades).toHaveLength(py.trades.length);
    ts.trades.forEach((trade, i) => {
      const other = py.trades[i];
      expect(trade.entryTime).toBe(other.entryTime);
      expect(trade.exitTime).toBe(other.exitTime);
      expect(trade.entryPrice).toBeCloseTo(other.entryPrice, 6);
      expect(trade.exitPrice).toBeCloseTo(other.exitPrice, 6);
      expect(trade.returnPct).toBeCloseTo(other.returnPct, 6);
    });
    expect(Boolean(ts.openTrade)).toBe(Boolean(py.openTrade));
    expect(ts.openTrade?.entryTime).toBe(py.openTrade?.entryTime);
    expect(ts.returnPct).toBeCloseTo(py.stats.returnPct, 6);
    // Python holds from the first bar; the page holds from the first bar the
    // strategy could trade on.
    expect(ts.holdFrom).toBe(bars[200].time);
    expect(ts.buyHoldPct).toBeCloseTo((bars.at(-1)!.close / bars[200].open - 1) * 100, 6);
    expect(ts.maxDrawdownPct).toBeCloseTo(py.stats.maxDrawdownPct, 6);
    expect(ts.fees).toBeCloseTo(py.stats.fees, 6);
    expect(ts.winRatePct ?? -1).toBeCloseTo(py.stats.winRatePct ?? -1, 6);
    expect(ts.equity).toHaveLength(py.equity.length);
    expect(ts.equity.at(-1)!.value).toBeCloseTo(py.equity.at(-1).value, 4);
  });

  it("makes no trade before there are 200 bars, and has nothing to compare", () => {
    expect(goldenCrossBacktest(swings(200))).toBeNull();
    const result = goldenCrossBacktest(swings(201))!;
    expect(result.trades).toEqual([]);
    expect(result.holdFrom).toBe(swings(201)[200].time);
  });
});
