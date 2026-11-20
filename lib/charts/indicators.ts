import { ema, type Candle, type LinePoint } from "@/lib/data/chart-data";

export type Bands = {
  middle: LinePoint[];
  upper: LinePoint[];
  lower: LinePoint[];
};

/**
 * Bollinger Bands: the simple average of the last `length` closes, with a band
 * `deviations` standard deviations (of the whole window, not a sample) either
 * side of it.
 */
export function bollinger(
  candles: readonly Candle[],
  length: number,
  deviations: number,
): Bands {
  const out: Bands = { middle: [], upper: [], lower: [] };
  for (let i = length - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - length + 1; j <= i; j++) sum += candles[j].close;
    const mean = sum / length;
    let squares = 0;
    for (let j = i - length + 1; j <= i; j++)
      squares += (candles[j].close - mean) ** 2;
    const spread = deviations * Math.sqrt(squares / length);
    const time = candles[i].time;
    out.middle.push({ time, value: mean });
    out.upper.push({ time, value: mean + spread });
    out.lower.push({ time, value: mean - spread });
  }
  return out;
}

/**
 * Wilder's RSI: the first average gain and loss are the plain averages of the
 * first `length` moves, each later one keeps (length - 1) / length of the last.
 * A flat window, with no gains and no losses, reads 50.
 */
export function rsi(candles: readonly Candle[], length: number): LinePoint[] {
  const out: LinePoint[] = [];
  if (candles.length <= length) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < candles.length; i++) {
    const move = candles[i].close - candles[i - 1].close;
    const up = Math.max(move, 0);
    const down = Math.max(-move, 0);
    if (i <= length) {
      gain += up / length;
      loss += down / length;
      if (i < length) continue;
    } else {
      gain = (gain * (length - 1) + up) / length;
      loss = (loss * (length - 1) + down) / length;
    }
    const value =
      loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
    out.push({ time: candles[i].time, value });
  }
  return out;
}

export type Macd = {
  macd: LinePoint[];
  signal: LinePoint[];
  histogram: LinePoint[];
};

/**
 * MACD: the fast average of the closes less the slow one, from the bar the slow
 * one is drawn from; the signal is an average of that line, and the histogram
 * the gap between them. The averages are the chart's own EMA, seeded with the
 * first value.
 */
export function macd(
  candles: readonly Candle[],
  fast: number,
  slow: number,
  signal: number,
): Macd {
  const out: Macd = { macd: [], signal: [], histogram: [] };
  const start = Math.max(fast, slow) - 1;
  if (candles.length <= start) return out;
  const closes = candles.map((candle) => candle.close);
  const quick = ema(closes, fast);
  const steady = ema(closes, slow);
  const line = closes
    .slice(start)
    .map((_, i) => quick[start + i] - steady[start + i]);
  const smooth = ema(line, signal);
  line.forEach((value, i) => {
    const time = candles[start + i].time;
    out.macd.push({ time, value });
    if (i < signal - 1) return;
    out.signal.push({ time, value: smooth[i] });
    out.histogram.push({ time, value: value - smooth[i] });
  });
  return out;
}
