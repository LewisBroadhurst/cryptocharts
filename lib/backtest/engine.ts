/**
 * The backtest engine, in Python. It runs inside Pyodide in the sandbox, and
 * under plain python3 in tests. It calls the reader's `on_bar(bar, ctx)` once
 * per bar, oldest first, and fills each order at the next bar's open, so a
 * strategy can never trade on a price it hadn't seen yet.
 */
export const ENGINE_PY = String.raw`
import json, math, traceback, sys, io

START_CASH = 10_000.0
MAX_LOG_LINES = 200


class Bar:
    __slots__ = ("time", "open", "high", "low", "close", "volume")

    def __init__(self, raw):
        self.time = int(raw["time"])
        self.open = float(raw["open"])
        self.high = float(raw["high"])
        self.low = float(raw["low"])
        self.close = float(raw["close"])
        self.volume = float(raw.get("volume") or 0.0)

    def __repr__(self):
        return f"Bar(time={self.time}, open={self.open}, high={self.high}, low={self.low}, close={self.close})"


def _ema_series(values, n):
    out, k, prev = [], 2 / (n + 1), None
    for v in values:
        prev = v if prev is None else v * k + prev * (1 - k)
        out.append(prev)
    return out


def _rsi_series(closes, n):
    out = [None] * len(closes)
    gain = loss = 0.0
    for i in range(1, len(closes)):
        change = closes[i] - closes[i - 1]
        up, down = max(change, 0.0), max(-change, 0.0)
        if i <= n:
            gain += up / n
            loss += down / n
            if i < n:
                continue
        else:
            gain = (gain * (n - 1) + up) / n
            loss = (loss * (n - 1) + down) / n
        out[i] = 100.0 if loss == 0 else 100 - 100 / (1 + gain / loss)
    return out


class Context:
    """What a strategy sees: the bars so far, a few indicators, and its orders."""

    def __init__(self, bars):
        self._bars = bars
        self._closes = [b.close for b in bars]
        self._cache = {}
        self.i = 0
        self.position = 0
        self._order = None

    @property
    def bars(self):
        """Every bar up to and including this one, oldest first."""
        return self._bars[: self.i + 1]

    def closes(self, n=None):
        upto = self._closes[: self.i + 1]
        return upto if n is None else upto[-n:]

    def sma(self, n):
        if self.i + 1 < n:
            return None
        return sum(self._closes[self.i + 1 - n : self.i + 1]) / n

    def ema(self, n):
        key = ("ema", n)
        if key not in self._cache:
            # Each value uses only bars up to its own, so the whole run is safe to work out once.
            self._cache[key] = _ema_series(self._closes, n)
        return self._cache[key][self.i] if self.i + 1 >= n else None

    def rsi(self, n=14):
        key = ("rsi", n)
        if key not in self._cache:
            self._cache[key] = _rsi_series(self._closes, n)
        return self._cache[key][self.i]

    def highest(self, n):
        return max(b.high for b in self._bars[max(0, self.i + 1 - n) : self.i + 1])

    def lowest(self, n):
        return min(b.low for b in self._bars[max(0, self.i + 1 - n) : self.i + 1])

    def buy(self):
        """Go long with everything, at the next bar's open."""
        self._order = 1

    def sell(self):
        """Go short with everything, at the next bar's open."""
        self._order = -1

    def close(self):
        """Close whatever is open, at the next bar's open."""
        self._order = 0


class _Log(io.TextIOBase):
    """Collects printed lines; print() writes a line in pieces, so whole lines are kept."""

    def __init__(self):
        self._lines = []
        self._partial = ""

    def write(self, text):
        self._partial += text
        *done, self._partial = self._partial.split("\n")
        for line in done:
            self._add(line)
        return len(text)

    def _add(self, line):
        if len(self._lines) < MAX_LOG_LINES:
            self._lines.append(line)
        elif len(self._lines) == MAX_LOG_LINES:
            self._lines.append("… more output not shown")

    @property
    def lines(self):
        return self._lines + ([self._partial] if self._partial else [])


def run_backtest(code, bars_json, fee_pct, slippage_pct):
    log = _Log()
    out, err = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = log
    try:
        return json.dumps(_run(code, json.loads(bars_json), fee_pct / 100, slippage_pct / 100, log))
    except Exception:
        return json.dumps({"ok": False, "error": traceback.format_exc(limit=-3), "log": log.lines})
    finally:
        sys.stdout, sys.stderr = out, err


def _run(code, raw_bars, fee, slip, log):
    bars = [Bar(b) for b in raw_bars]
    if len(bars) < 2:
        return {"ok": False, "error": "There aren't enough bars to test on.", "log": log.lines}
    space = {"__name__": "strategy"}
    exec(compile(code, "strategy.py", "exec"), space)
    on_bar = space.get("on_bar")
    if not callable(on_bar):
        return {"ok": False, "error": "Your strategy needs an on_bar(bar, ctx) function.", "log": log.lines}

    ctx = Context(bars)
    cash, units, side = START_CASH, 0.0, 0
    entry = None
    trades, equity, fees = [], [], 0.0

    def equity_at(price):
        return cash + units * price

    for i, bar in enumerate(bars):
        order, ctx._order = ctx._order, None
        if order is not None and order != side:
            if side != 0:
                # Close: sell a long below the open, buy back a short above it.
                price = bar.open * (1 - slip * side)
                value = units * price
                fee_paid = abs(value) * fee
                cash += value - fee_paid
                fees += fee_paid
                ret = (price / entry["price"] - 1) * side * 100
                trades.append({**entry, "exitTime": bar.time, "exitPrice": price, "returnPct": ret})
                units, side, entry = 0.0, 0, None
            if order != 0:
                price = bar.open * (1 + slip * order)
                fee_paid = cash * fee
                fees += fee_paid
                stake = cash - fee_paid
                units = order * stake / price
                # A long spends the stake; a short receives it from the sale.
                cash = cash - fee_paid - stake if order == 1 else cash - fee_paid + stake
                side = order
                entry = {"side": "long" if order == 1 else "short", "entryTime": bar.time, "entryPrice": price, "price": price}
        ctx.i = i
        ctx.position = side
        on_bar(bar, ctx)
        equity.append({"time": bar.time, "value": equity_at(bar.close)})

    open_trade = None
    if entry is not None:
        last = bars[-1].close
        open_trade = {**entry, "markPrice": last, "returnPct": (last / entry["price"] - 1) * side * 100}

    peak, worst = equity[0]["value"], 0.0
    for point in equity:
        peak = max(peak, point["value"])
        worst = min(worst, point["value"] / peak - 1)
    wins = [t for t in trades if t["returnPct"] > 0]
    end = equity[-1]["value"]
    for t in trades:
        t.pop("price", None)
    if open_trade:
        open_trade.pop("price", None)
    return {
        "ok": True,
        "trades": trades,
        "openTrade": open_trade,
        "equity": equity,
        "stats": {
            "startCash": START_CASH,
            "endEquity": end,
            "returnPct": (end / START_CASH - 1) * 100,
            "buyHoldPct": (bars[-1].close / bars[0].open - 1) * 100,
            "trades": len(trades),
            "winRatePct": (len(wins) / len(trades) * 100) if trades else None,
            "maxDrawdownPct": worst * 100,
            "fees": fees,
        },
        "log": log.lines,
    }
`;

export const EXAMPLE_STRATEGY = `# Called once for every bar, oldest first. Orders fill at the next bar's open.
#
# bar:  bar.time, bar.open, bar.high, bar.low, bar.close, bar.volume
# ctx:  ctx.position (1 long, -1 short, 0 flat)
#       ctx.sma(n), ctx.ema(n), ctx.rsi(n), ctx.highest(n), ctx.lowest(n)
#       ctx.closes(n), ctx.bars
#       ctx.buy(), ctx.sell(), ctx.close()
# print() shows in the log.
# numpy is available: import numpy as np (about 3 MB, loaded the first time
# a script imports it), e.g. np.std(ctx.closes(20)).

def on_bar(bar, ctx):
    fast, slow = ctx.ema(9), ctx.ema(21)
    if fast is None or slow is None:
        return
    if fast > slow and ctx.position <= 0:
        ctx.buy()
    elif fast < slow and ctx.position > 0:
        ctx.close()
`;

export type BacktestTrade = {
  side: "long" | "short";
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  returnPct: number;
};

export type BacktestResult =
  | {
      ok: true;
      trades: BacktestTrade[];
      openTrade:
        | (Omit<BacktestTrade, "exitTime" | "exitPrice"> & { markPrice: number })
        | null;
      equity: { time: number; value: number }[];
      stats: {
        startCash: number;
        endEquity: number;
        returnPct: number;
        buyHoldPct: number;
        trades: number;
        winRatePct: number | null;
        maxDrawdownPct: number;
        fees: number;
      };
      log: string[];
    }
  | { ok: false; error: string; log: string[] };

const isNum = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Checks what came back from the sandbox. The script ran there, so its answer
 * is untrusted: anything not shaped like a result is refused.
 */
export function readResult(value: unknown): BacktestResult | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const log = Array.isArray(raw.log)
    ? raw.log.filter((line): line is string => typeof line === "string").slice(0, 201)
    : [];
  if (raw.ok === false)
    return { ok: false, error: String(raw.error ?? "The script failed").slice(0, 4_000), log };
  if (raw.ok !== true || !Array.isArray(raw.trades) || !Array.isArray(raw.equity))
    return null;
  const stats = raw.stats as Record<string, unknown> | undefined;
  if (!stats || !isNum(stats.returnPct)) return null;
  const trades = raw.trades.filter(
    (t): t is BacktestTrade =>
      typeof t === "object" &&
      t !== null &&
      isNum((t as BacktestTrade).entryTime) &&
      isNum((t as BacktestTrade).exitTime) &&
      isNum((t as BacktestTrade).entryPrice) &&
      isNum((t as BacktestTrade).exitPrice) &&
      isNum((t as BacktestTrade).returnPct) &&
      ((t as BacktestTrade).side === "long" || (t as BacktestTrade).side === "short"),
  );
  const equity = raw.equity.filter(
    (p): p is { time: number; value: number } =>
      typeof p === "object" &&
      p !== null &&
      isNum((p as { time: unknown }).time) &&
      isNum((p as { value: unknown }).value),
  );
  const open = raw.openTrade as Record<string, unknown> | null;
  return {
    ok: true,
    trades,
    openTrade:
      open && isNum(open.entryTime) && isNum(open.entryPrice) && isNum(open.markPrice) && isNum(open.returnPct)
        ? {
            side: open.side === "short" ? "short" : "long",
            entryTime: open.entryTime,
            entryPrice: open.entryPrice,
            markPrice: open.markPrice,
            returnPct: open.returnPct,
          }
        : null,
    equity,
    stats: {
      startCash: isNum(stats.startCash) ? stats.startCash : 10_000,
      endEquity: isNum(stats.endEquity) ? stats.endEquity : 0,
      returnPct: stats.returnPct,
      buyHoldPct: isNum(stats.buyHoldPct) ? stats.buyHoldPct : 0,
      trades: trades.length,
      winRatePct: isNum(stats.winRatePct) ? stats.winRatePct : null,
      maxDrawdownPct: isNum(stats.maxDrawdownPct) ? stats.maxDrawdownPct : 0,
      fees: isNum(stats.fees) ? stats.fees : 0,
    },
    log,
  };
}
