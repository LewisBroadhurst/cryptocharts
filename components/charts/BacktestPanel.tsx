"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  EXAMPLE_STRATEGY,
  type BacktestResult,
} from "@/lib/backtest/engine";
import type { Candle } from "@/lib/data/chart-data";
import { chartStamp } from "@/lib/dates";
import { readStoredJson, writeStoredJson } from "@/lib/site/browser-storage";
import { cn } from "@/lib/utils";
import { CloseIcon } from "@/components/charts/ChartIcons";
import EquityChart from "@/components/charts/EquityChart";
import { useBacktestSandbox } from "@/hooks/useBacktestSandbox";

const SCRIPT_KEY = "cryptocharts.backtest.script.v1";
const COSTS_KEY = "cryptocharts.backtest.costs.v1";
/** A script bigger than this is almost certainly not a strategy. */
const MAX_SCRIPT_BYTES = 100_000;

const BUTTON =
  "flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted disabled:opacity-40";
const FIELD =
  "h-8 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground tabular-nums focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted";

const loadScript = () => {
  const saved = readStoredJson(SCRIPT_KEY);
  return typeof saved === "string" && saved.trim() ? saved : EXAMPLE_STRATEGY;
};
const loadCosts = () => {
  const saved = readStoredJson(COSTS_KEY) as { fee?: unknown; slippage?: unknown } | null;
  const pick = (value: unknown, fallback: number) =>
    typeof value === "number" && value >= 0 && value <= 5 ? value : fallback;
  return { fee: pick(saved?.fee, 0.1), slippage: pick(saved?.slippage, 0.05) };
};

const pct = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
const money = (value: number) =>
  `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export default function BacktestPanel({
  bars,
  label,
  upTo,
  result,
  onResult,
  onClose,
}: {
  bars: readonly Candle[];
  /** The pair and interval tested, e.g. "BTC-USD · 1h". */
  label: string;
  /** In a replay, the newest bar shown: results past it stay hidden. */
  upTo: number | null;
  result: BacktestResult | null;
  onResult: (result: BacktestResult | null) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState(loadScript);
  const [costs, setCosts] = useState(loadCosts);
  const [running, setRunning] = useState(false);
  const [uploadProblem, setUploadProblem] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const outcomeRef = useRef<HTMLDivElement>(null);
  const sandbox = useBacktestSandbox();
  const { warm } = sandbox;

  // Python starts while the reader reads the example, not when they press Run.
  useEffect(() => warm(), [warm]);

  useEffect(() => {
    writeStoredJson(SCRIPT_KEY, code);
  }, [code]);
  useEffect(() => {
    writeStoredJson(COSTS_KEY, costs);
  }, [costs]);

  const run = async () => {
    setRunning(true);
    onResult(null);
    const outcome = await sandbox.run({
      code,
      bars: bars.map(({ time, open, high, low, close, volume }) => ({
        time,
        open,
        high,
        low,
        close,
        volume,
      })),
      fee: costs.fee,
      slippage: costs.slippage,
    });
    setRunning(false);
    onResult(outcome);
    // The results sit under the editor: bring them into view.
    requestAnimationFrame(() =>
      outcomeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  const upload = async (picked: File | undefined) => {
    setUploadProblem(null);
    if (!picked) return;
    if (picked.size > MAX_SCRIPT_BYTES) {
      setUploadProblem("That file is too big to be a strategy (over 100 KB).");
      return;
    }
    setCode(await picked.text());
  };

  const shown = useMemo(() => {
    if (!result?.ok) return result;
    if (upTo === null) return result;
    return {
      ...result,
      equity: result.equity.filter((point) => point.time <= upTo),
      trades: result.trades.filter((trade) => trade.exitTime <= upTo),
    };
  }, [result, upTo]);

  const starting = sandbox.status === "loading";

  return (
    <aside
      aria-label="Backtest"
      className="flex w-[24rem] shrink-0 flex-col overflow-y-auto border-l border-border bg-background max-lg:absolute max-lg:inset-0 max-lg:z-40 max-lg:w-full max-lg:border-l-0"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold text-foreground">Backtest</h2>
        <span className="text-xs text-muted-foreground">{label}</span>
        <button
          type="button"
          aria-label="Close backtest"
          onClick={onClose}
          className={cn(BUTTON, "ml-auto px-1.5 text-subtle-foreground hover:bg-secondary hover:text-foreground")}
        >
          <CloseIcon className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <label htmlFor="backtest-script" className="text-xs font-medium text-subtle-foreground">
              Python strategy
            </label>
            <button
              type="button"
              onClick={() => file.current?.click()}
              className={cn(BUTTON, "ml-auto h-7 text-subtle-foreground hover:bg-secondary hover:text-foreground")}
            >
              Upload .py
            </button>
            <button
              type="button"
              onClick={() => setCode(EXAMPLE_STRATEGY)}
              className={cn(BUTTON, "h-7 text-subtle-foreground hover:bg-secondary hover:text-foreground")}
            >
              Example
            </button>
            <input
              ref={file}
              type="file"
              accept=".py,text/x-python,text/plain"
              className="hidden"
              aria-label="Upload a Python file"
              onChange={(event) => {
                void upload(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
          <textarea
            id="backtest-script"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            spellCheck={false}
            wrap="off"
            autoCapitalize="off"
            autoCorrect="off"
            rows={14}
            className="min-h-48 w-full resize-y rounded-md border border-border bg-surface p-2 font-mono text-xs leading-relaxed text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted"
          />
          {uploadProblem && <p className="text-xs text-negative">{uploadProblem}</p>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-subtle-foreground">
            Fee per trade (%)
            <input
              type="number"
              min={0}
              max={5}
              step={0.01}
              value={costs.fee}
              onChange={(event) =>
                setCosts((now) => ({ ...now, fee: Math.min(5, Math.max(0, Number(event.target.value) || 0)) }))
              }
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-subtle-foreground">
            Slippage (%)
            <input
              type="number"
              min={0}
              max={5}
              step={0.01}
              value={costs.slippage}
              onChange={(event) =>
                setCosts((now) => ({ ...now, slippage: Math.min(5, Math.max(0, Number(event.target.value) || 0)) }))
              }
              className={FIELD}
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          {running ? (
            <button
              type="button"
              onClick={() => {
                sandbox.stop();
                setRunning(false);
              }}
              className={cn(BUTTON, "bg-secondary text-foreground hover:bg-secondary/80")}
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              disabled={bars.length < 2}
              onClick={() => void run()}
              className={cn(BUTTON, "bg-brand text-background hover:bg-brand/90")}
            >
              Run on {bars.length} bars
            </button>
          )}
          <p role="status" className="text-xs text-muted-foreground">
            {starting
              ? "Starting Python (about 12 MB the first time)…"
              : running
                ? "Running…"
                : sandbox.problem ?? ""}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Your script runs in your own browser, shut off from the page and the
          internet. It isn&apos;t sent anywhere.
        </p>

        <div ref={outcomeRef} className="scroll-mt-3" />
        {shown && !shown.ok && (
          <pre
            role="alert"
            className="max-h-60 overflow-auto rounded-md border border-negative/40 bg-surface p-2 text-xs whitespace-pre-wrap text-negative"
          >
            {shown.error}
          </pre>
        )}

        {shown?.ok && (
          <section aria-label="Results" className="flex flex-col gap-3">
            <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-xs">
              {(
                [
                  ["Return", pct(shown.stats.returnPct), shown.stats.returnPct >= 0],
                  ["Buy and hold", pct(shown.stats.buyHoldPct), shown.stats.buyHoldPct >= 0],
                  ["Worst drop", pct(shown.stats.maxDrawdownPct), false],
                  ["Trades", String(shown.stats.trades), null],
                  [
                    "Won",
                    shown.stats.winRatePct === null ? "–" : `${shown.stats.winRatePct.toFixed(0)}%`,
                    null,
                  ],
                  ["Fees", money(shown.stats.fees), null],
                ] as const
              ).map(([name, value, good]) => (
                <div key={name}>
                  <dt className="text-muted-foreground">{name}</dt>
                  <dd
                    className={cn(
                      "text-sm font-semibold tabular-nums text-foreground",
                      good === true && "text-positive",
                      good === false && "text-negative",
                    )}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <EquityChart points={shown.equity} />
            <p className="text-xs text-muted-foreground">
              A simulation on past prices, starting with {money(shown.stats.startCash)}. It
              isn&apos;t advice, and past results don&apos;t predict future ones.
              {upTo !== null && " Replaying: only trades up to the replay's bar are shown."}
            </p>
            {shown.trades.length > 0 && (
              <table className="w-full text-xs tabular-nums">
                <caption className="sr-only">Trades</caption>
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="font-normal">Side</th>
                    <th className="font-normal">In</th>
                    <th className="font-normal">Out</th>
                    <th className="text-right font-normal">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.trades.slice(-50).reverse().map((trade) => (
                    <tr key={`${trade.entryTime}-${trade.exitTime}`} className="border-t border-border">
                      <td className="py-1">{trade.side === "long" ? "Long" : "Short"}</td>
                      <td>{chartStamp(trade.entryTime)}</td>
                      <td>{chartStamp(trade.exitTime)}</td>
                      <td className={cn("text-right", trade.returnPct >= 0 ? "text-positive" : "text-negative")}>
                        {pct(trade.returnPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {shown && shown.log.length > 0 && (
          <details className="text-xs">
            <summary className="text-subtle-foreground">Printed output ({shown.log.length} lines)</summary>
            <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-surface p-2 whitespace-pre-wrap text-foreground">
              {shown.log.join("\n")}
            </pre>
          </details>
        )}
      </div>
    </aside>
  );
}
