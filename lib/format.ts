export const EMPTY = "—";

export const MINUS = "\u2212";

export const signOf = (value: number): string =>
  value > 0 ? "+" : value < 0 ? MINUS : "";

export const decimal = (value: number, digits = 2): string => {
  const size = Math.abs(value).toFixed(digits);
  return `${value < 0 && Number(size) !== 0 ? MINUS : ""}${size}`;
};

/** A figure to `digits` places, always signed: "+4.21", "−0.50". The one
    signed-number rule: every signed figure on the site is written by this. */
export function signedFixed(
  value: number | null | undefined,
  suffix = "",
  digits = 2,
): string {
  if (typeof value !== "number" || Number.isNaN(value)) return EMPTY;
  const size = Math.abs(value).toFixed(digits);
  return `${Number(size) === 0 ? "" : signOf(value)}${size}${suffix}`;
}

export const pct = (value: number, digits: number): string =>
  `${decimal(value, digits)}%`;

export const sharePct = (ratio: number): string =>
  `${Math.round(ratio * 100)}%`;

export const grouped = (value: number): string => value.toLocaleString("en-GB");

export const signedPct = (value: number | null | undefined): string =>
  signedFixed(value, "%");

export const unsignedPct = (value: number): string =>
  `${Math.abs(value).toFixed(1)}%`;

export const nonZero = <Missing = typeof EMPTY>(
  value: unknown,
  format: (n: number) => string,
  missing: Missing = EMPTY as Missing,
): string | Missing =>
  typeof value === "number" && value !== 0 ? format(value) : missing;

export const levelPct = (value: number | null | undefined): string =>
  typeof value === "number" ? pct(value, 1) : EMPTY;

/** Which way a figure reads once written to `digits` places: a move written
    "0.0%" reads as none, whichever side of zero it was. */
export function shownSide(
  value: number | null | undefined,
  digits = 1,
): -1 | 0 | 1 {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const shown = Number(value.toFixed(digits));
  return shown > 0 ? 1 : shown < 0 ? -1 : 0;
}

const TONE = {
  [-1]: "text-negative",
  0: "text-subtle-foreground",
  1: "text-positive",
} as const;

/** A signed figure's colour, from the figure as written to `digits` places. */
export const signedTone = (
  value: number | null | undefined,
  digits = 1,
): string => TONE[shownSide(value, digits)];

const PRICE = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** A price, to two places with its thousands grouped: "1,234.56". The one
    price rule: every price the site or the app shows is written by this. */
export const price = (value: number | null | undefined): string =>
  typeof value === "number" && Number.isFinite(value)
    ? PRICE.format(value)
    : EMPTY;

export function joined(
  items: readonly string[],
  word: "and" | "or" = "and",
  { serial = false }: { serial?: boolean } = {},
): string {
  if (items.length < 2) return items[0] ?? "";
  const comma =
    serial && items.some((item) => / (and|or) /.test(item)) ? "," : "";
  return `${items.slice(0, -1).join(", ")}${comma} ${word} ${items.at(-1)}`;
}

export const movePct = (value: number | null | undefined): string =>
  signedFixed(value, "%", 1);

export const multiple = (value: number, digits = 1): string =>
  `${decimal(value, digits)}×`;

export const multipleOrLoss = (value: number | null): string =>
  value === null ? EMPTY : value > 0 ? multiple(value) : "Loss";

export const capitalise = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

const ORDINAL = new Intl.PluralRules("en-GB", { type: "ordinal" });
const ORDINAL_SUFFIX: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: "st",
  two: "nd",
  few: "rd",
};

export function ordinal(value: number): string {
  const whole = Math.round(value);
  return `${whole}${ORDINAL_SUFFIX[ORDINAL.select(whole)] ?? "th"}`;
}

const COUNT_WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

export const countWord = (count: number): string =>
  COUNT_WORDS[count] ?? String(count);

export function daysSpan(
  days: number,
  { fortnight = false }: { fortnight?: boolean } = {},
): string {
  if (days === 0 || days % 7 !== 0)
    return `${days} ${days === 1 ? "day" : "days"}`;
  const weeks = days / 7;
  if (weeks === 1) return "a week";
  if (weeks === 2 && fortnight) return "a fortnight";
  return `${countWord(weeks)} weeks`;
}
