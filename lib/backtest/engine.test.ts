// Runs the engine under the machine's python3: the same code Pyodide runs.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ENGINE_PY, EXAMPLE_STRATEGY, readResult } from "@/lib/backtest/engine";

const dir = mkdtempSync(path.join(tmpdir(), "engine-"));
writeFileSync(path.join(dir, "engine.py"), ENGINE_PY);

function run(code: string, bars: object[], fee = 0, slippage = 0) {
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
    { encoding: "utf8" },
  );
  return JSON.parse(out);
}

const bars = (opens: number[]) =>
  opens.map((open, i) => ({ time: 1_000 + i * 60, open, high: open, low: open, close: open }));

describe("the backtest engine", () => {
  it("fills an order at the next bar's open, never the bar it was given on", () => {
    const result = run(
      `def on_bar(bar, ctx):
    if bar.time == 1000: ctx.buy()
    if bar.time == 1120: ctx.close()`,
      bars([100, 110, 120, 130]),
    );
    expect(result.ok).toBe(true);
    expect(result.trades).toEqual([
      expect.objectContaining({ side: "long", entryTime: 1060, entryPrice: 110, exitTime: 1180, exitPrice: 130 }),
    ]);
    expect(result.trades[0].returnPct).toBeCloseTo((130 / 110 - 1) * 100);
    expect(result.stats.returnPct).toBeCloseTo((130 / 110 - 1) * 100);
  });

  it("makes money short when the price falls", () => {
    const result = run(
      `def on_bar(bar, ctx):
    if ctx.position == 0 and bar.time == 1000: ctx.sell()`,
      bars([100, 100, 50]),
    );
    expect(result.openTrade).toMatchObject({ side: "short", entryPrice: 100, markPrice: 50 });
    expect(result.stats.endEquity).toBeCloseTo(15_000);
  });

  it("takes fees and slippage off both sides of a trade", () => {
    const result = run(
      `def on_bar(bar, ctx):
    if bar.time == 1000: ctx.buy()
    if bar.time == 1060: ctx.close()`,
      bars([100, 100, 100]),
      0.1,
      0.05,
    );
    expect(result.stats.endEquity).toBeLessThan(10_000);
    expect(result.stats.fees).toBeCloseTo(20, 0);
    expect(result.trades[0].entryPrice).toBeCloseTo(100.05);
    expect(result.trades[0].exitPrice).toBeCloseTo(99.95);
  });

  it("gives indicators only the bars seen so far", () => {
    const result = run(
      `def on_bar(bar, ctx):
    print(bar.time, ctx.sma(2), len(ctx.bars))`,
      bars([10, 20, 30]),
    );
    expect(result.log).toEqual(["1000 None 1", "1060 15.0 2", "1120 25.0 3"]);
  });

  it("runs the example strategy", () => {
    const wave = Array.from({ length: 300 }, (_, i) => 100 + 20 * Math.sin(i / 15));
    const result = run(EXAMPLE_STRATEGY, bars(wave));
    expect(result.ok).toBe(true);
    expect(result.stats.trades).toBeGreaterThan(2);
    expect(readResult(result)).not.toBeNull();
  });

  it("says what went wrong in the reader's script", () => {
    const missing = run("x = 1", bars([1, 2]));
    expect(missing).toMatchObject({ ok: false, error: expect.stringContaining("on_bar") });

    const broken = run("def on_bar(bar, ctx):\n    return 1 / 0", bars([1, 2]));
    expect(broken.ok).toBe(false);
    expect(broken.error).toContain("ZeroDivisionError");
    expect(broken.error).toContain("strategy.py");
  });
});

describe("readResult", () => {
  it("refuses anything not shaped like a result", () => {
    expect(readResult(null)).toBeNull();
    expect(readResult({ ok: true })).toBeNull();
    expect(readResult("<img src=x>")).toBeNull();
  });

  it("drops trades with missing or non-number fields", () => {
    const result = readResult({
      ok: true,
      trades: [{ side: "long", entryTime: "x" }],
      equity: [],
      stats: { returnPct: 1 },
      log: [],
      openTrade: null,
    });
    expect(result).toMatchObject({ ok: true, trades: [] });
  });
});
