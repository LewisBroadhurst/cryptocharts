import { describe, expect, it } from "vitest";

import {
  DEFAULT_STUDIES,
  emaLine,
  makeStudy,
  shapeSettings,
  smaLine,
  studyLabel,
  studyOutputs,
  studyShape,
} from "@/lib/charts/studies";

const candles = [10, 11, 12, 13, 14, 20].map((close, i) => ({
  time: i,
  open: close,
  high: close,
  low: close,
  close,
}));

describe("smaLine", () => {
  it("averages each window of closes, starting once the window is full", () => {
    expect(smaLine(candles, 3)).toEqual([
      { time: 2, value: 11 },
      { time: 3, value: 12 },
      { time: 4, value: 13 },
      { time: 5, value: 47 / 3 },
    ]);
  });
});

describe("emaLine", () => {
  it("is the board's average: seeded with the first close, each close weighted by 2 / (length + 1), drawn from the window's end", () => {
    const line = emaLine(candles, 3);
    expect(line[0]).toEqual({ time: 2, value: 11.25 });
    expect(line.map((point) => point.value)).toEqual([
      11.25, 12.125, 13.0625, 16.53125,
    ]);
  });

  it("draws nothing until there are enough bars", () => {
    expect(emaLine(candles, 10)).toEqual([]);
  });

  it("follows the closes more closely than a simple average of the same length", () => {
    expect(emaLine(candles, 3).at(-1)!.value).toBeGreaterThan(
      smaLine(candles, 3).at(-1)!.value,
    );
  });
});

describe("makeStudy", () => {
  it("keeps EMA200 in the site's yellow, unless a line already has it", () => {
    expect(makeStudy("ema", 200, []).color).toBe("#facc15");
    expect(makeStudy("ema", 200, DEFAULT_STUDIES).color).not.toBe("#facc15");
  });

  it("gives a second average of the same length its own id", () => {
    const first = makeStudy("ema", 50, []);
    expect(makeStudy("ema", 50, [first]).id).not.toBe(first.id);
  });
});

describe("the other studies", () => {
  it("start MACD at 12, 26 and 9, and name each study by its settings", () => {
    const study = makeStudy("macd", 12, []);
    expect(study).toMatchObject({ slow: 26, signal: 9 });
    expect(studyLabel(study)).toBe("MACD 12 26 9");
    expect(studyLabel(makeStudy("bb", 20, []))).toBe("BB 20 2");
    expect(studyLabel(makeStudy("rsi", 14, []))).toBe("RSI 14");
  });

  it("draw three lines for the bands and for MACD, one for RSI", () => {
    const bars = Array.from({ length: 40 }, (_, i) => ({
      time: i,
      open: 10 + (i % 5),
      high: 10 + (i % 5),
      low: 10 + (i % 5),
      close: 10 + (i % 5),
    }));
    expect(studyOutputs(makeStudy("bb", 20, []), bars)).toHaveLength(3);
    expect(studyOutputs(makeStudy("rsi", 14, []), bars)).toHaveLength(1);
    const [line, signal, histogram] = studyOutputs(
      makeStudy("macd", 12, []),
      bars,
    );
    expect(line[0].time).toBe(25);
    expect(signal[0].time).toBe(33);
    expect(histogram).toHaveLength(signal.length);
  });

  it("key MACD by every length, so changing the slow one redraws it", () => {
    const study = makeStudy("macd", 12, []);
    expect(studyShape(study)).not.toBe(studyShape({ ...study, slow: 30 }));
    expect(shapeSettings(studyShape(study))).toEqual({
      kind: "macd",
      length: 12,
      slow: 26,
      signal: 9,
    });
    expect(shapeSettings(studyShape(makeStudy("rsi", 14, [])))).toEqual({
      kind: "rsi",
      length: 14,
    });
  });
});
