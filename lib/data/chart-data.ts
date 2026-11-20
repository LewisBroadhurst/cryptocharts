export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type LinePoint = { time: number; value: number };

export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (const value of values) {
    prev = out.length === 0 ? value : value * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}
