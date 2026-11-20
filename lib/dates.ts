import { ordinal } from "@/lib/format";

// Every formatter is made once: `toLocaleDateString` builds one on every call,
// the board dates a quarter for every name it grades and a chart labels every
// bar.
const utc = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" });

const DAY_AND_MONTH = utc({ day: "numeric", month: "short" });

export function shortDate(iso: string): string {
  return DAY_AND_MONTH.format(new Date(iso));
}

const MONTH_SHORT = utc({ month: "short" });
const MONTH_LONG = utc({ month: "long" });
const YEAR_SHORT = utc({ year: "2-digit" });
const MONTH_AND_YEAR = utc({ month: "short", year: "numeric" });
const LONG_MONTH_AND_YEAR = utc({ month: "long", year: "numeric" });
const WEEKDAY_SHORT_DATE = utc({
  weekday: "short",
  day: "numeric",
  month: "short",
});
const WEEKDAY_LONG = utc({ weekday: "long" });
const WEEKDAY_LONG_DATE = utc({
  weekday: "long",
  day: "numeric",
  month: "long",
});
const LONG_DATE = utc({ day: "numeric", month: "long", year: "numeric" });
const SHORT_DATE_WITH_YEAR = utc({
  day: "numeric",
  month: "short",
  year: "numeric",
});
const PADDED_SHORT_DATE = utc({
  day: "2-digit",
  month: "short",
  year: "2-digit",
});

export const monthYear = (at: Date): string => MONTH_AND_YEAR.format(at);

export function daySpan(date: string, endDate: string | null): string {
  if (!endDate) return shortDate(date);
  const sameMonth = date.slice(0, 7) === endDate.slice(0, 7);
  if (sameMonth) {
    return `${new Date(date).getUTCDate()}\u2013${shortDate(endDate)}`;
  }
  return `${shortDate(date)} \u2013 ${shortDate(endDate)}`;
}

export function weekdayDate(iso: string): string {
  return WEEKDAY_SHORT_DATE.format(new Date(iso));
}

export const weekdayLongDate = (iso: string): string =>
  WEEKDAY_LONG_DATE.format(new Date(iso));

export const monthShort = (iso: string): string =>
  MONTH_SHORT.format(new Date(iso));

export const yearShort = (iso: string): string =>
  YEAR_SHORT.format(new Date(iso));

export type DateFormat = "dmy" | "mdy" | "iso";

export const DEFAULT_DATE_FORMAT: DateFormat = "dmy";

export const DATE_FORMATS: readonly { id: DateFormat; label: string }[] = [
  { id: "dmy", label: "Day first: 31/03/2026" },
  { id: "mdy", label: "Month first: 03/31/2026" },
  { id: "iso", label: "Year first (ISO): 2026-03-31" },
];

export const DATE_PATTERN: Record<DateFormat, string> = {
  dmy: "DD/MM/YYYY",
  mdy: "MM/DD/YYYY",
  iso: "YYYY-MM-DD",
};

export function sanitizeDateFormat(value: unknown): DateFormat {
  return DATE_FORMATS.some((format) => format.id === value)
    ? (value as DateFormat)
    : DEFAULT_DATE_FORMAT;
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function numericDate(
  day: string,
  format: DateFormat = DEFAULT_DATE_FORMAT,
): string {
  const match = ISO_DAY.exec(day);
  if (!match) return day;
  const [, year, month, date] = match;
  if (format === "iso") return day;
  return format === "mdy"
    ? `${month}/${date}/${year}`
    : `${date}/${month}/${year}`;
}

export function utcDateTime(
  at: Date,
  format: DateFormat = DEFAULT_DATE_FORMAT,
): string {
  const iso = at.toISOString();
  const day = numericDate(iso.slice(0, 10), format);
  return `${day}${format === "iso" ? " " : ", "}${iso.slice(11, 16)}`;
}

export const YEAR_FIRST_DATE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;
export const SHORT_DATE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/;

const readsDayFirst = (format: DateFormat): boolean => format !== "mdy";

export const isTwoDigitYearFirst = (
  format: DateFormat,
  first: string,
  third: string,
): boolean => format === "iso" && first.length === 2 && third.length === 2;

export function typedDay(text: string, format: DateFormat): string | null {
  const pad = (n: string) => n.padStart(2, "0");
  const trimmed = text.trim();
  const iso = YEAR_FIRST_DATE.exec(trimmed);
  if (iso) return `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`;
  const short = SHORT_DATE.exec(trimmed);
  if (!short) return null;
  const [, first, second, third] = short;
  if (isTwoDigitYearFirst(format, first, third))
    return `20${first}-${pad(second)}-${pad(third)}`;
  const [day, month] = readsDayFirst(format)
    ? [first, second]
    : [second, first];
  const year = third.length === 2 ? `20${third}` : third;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function reorderDate(
  text: string,
  from: DateFormat,
  to: DateFormat,
): string {
  const day = typedDay(text, from);
  return day === null ? text : numericDate(day, to);
}

const chartDate = (time: number): Date => new Date(time * 1000);

export const chartDay = (time: number): string =>
  SHORT_DATE_WITH_YEAR.format(chartDate(time));

export const chartDayMonth = (time: number): string =>
  DAY_AND_MONTH.format(chartDate(time));

export const chartPaddedDay = (time: number): string =>
  PADDED_SHORT_DATE.format(chartDate(time));

export const chartMonthYear = (time: number): string =>
  LONG_MONTH_AND_YEAR.format(chartDate(time));

export function shortDateTime(at: Date): string {
  const iso = at.toISOString();
  return `${shortDate(iso)}, ${iso.slice(11, 16)} UTC`;
}

const LONDON_STAMP = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/London",
});

export const londonDateTime = (at: Date): string => LONDON_STAMP.format(at);

const LONDON_LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "Europe/London",
});

const LONDON_FULL_DATE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "full",
  timeZone: "Europe/London",
});

export const londonLongDate = (at: Date): string => LONDON_LONG_DATE.format(at);

export const londonFullDate = (at: Date): string => LONDON_FULL_DATE.format(at);

export const weekdayOf = (day: string): string =>
  WEEKDAY_LONG.format(new Date(day));

export function closeOf(day: string): string {
  return `${weekdayOf(day)}'s close, ${shortDate(day)}`;
}

export function ordinalDayMonth(day: string): string {
  const date = new Date(day);
  return `${ordinal(date.getUTCDate())} ${MONTH_LONG.format(date)}`;
}

export function longDate(iso: string): string {
  return LONG_DATE.format(new Date(iso));
}

export const utcDay = (at: Date): string => at.toISOString().slice(0, 10);

export type BoardDates = { updatedAt: Date | null; barDay: string | null };

export const boardDay = ({ updatedAt, barDay }: BoardDates): string | null =>
  barDay ?? (updatedAt ? utcDay(updatedAt) : null);

export const cardDate = (
  { updatedAt, barDay }: BoardDates,
  now: Date,
): string => barDay ?? utcDay(updatedAt ?? now);

export const utcDayStart = (day: string): string => `${day}T00:00:00Z`;

export const isMailDay = (at: Date): boolean =>
  [1, 3, 5].includes(at.getUTCDay());

/** Sunday: the weekly roundup's day, after Friday's close is graded. */
export const isWeeklyMailDay = (at: Date): boolean => at.getUTCDay() === 0;

export const isWeekend = (at: Date): boolean =>
  at.getUTCDay() === 0 || at.getUTCDay() === 6;

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;

export const mondayOf = (at: Date): string => {
  const day = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  return utcDay(new Date(day - ((at.getUTCDay() + 6) % 7) * DAY_MS));
};

export const addDays = (day: string, days: number): string =>
  utcDay(new Date(Date.parse(day) + days * DAY_MS));

export const daysUntil = (day: string, from: string): number =>
  Math.round((Date.parse(day) - Date.parse(from)) / DAY_MS);

export const inDays = (days: number): string =>
  days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;

export function weekdaysBetween(from: string, to: string): number {
  let count = 0;
  for (let at = Date.parse(from) + DAY_MS; at <= Date.parse(to); at += DAY_MS) {
    if (!isWeekend(new Date(at))) count++;
  }
  return count;
}

/** A bar's moment on an axis label: the day, and the time too for intraday bars. */
export const chartStamp = (time: number): string =>
  time % 86_400 === 0
    ? chartPaddedDay(time)
    : `${chartPaddedDay(time)} ${new Date(time * 1000).toISOString().slice(11, 16)}`;
