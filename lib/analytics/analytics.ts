import type { BeforeSendFn, PostHogConfig } from "posthog-js/dist/module.slim.no-external";

import { pairForPath } from "@/lib/site/seo";

/** The live site: only its visits are counted, never a preview, a fork or a
    developer's machine. */
export const COUNTED_HOST = "cryptocharts.stratdeck.uk";

/** PostHog's public project key. It only lets a page send events, so it is
    safe in a public repository (PostHog's own guidance). */
const KEY = "phc_vriCeVyeYee4SdFZvRngowgbaihC2QUVB3hnLzAAS3qX";

/** Events go to our own address, which next.config rewrites to PostHog's EU
    cloud, so the page talks to no other host. */
export const INGEST_PATH = "/ingest";

/** Everything the site counts, and what each carries. Every event also gets
    `pair`, the coin whose page it happened on, and `site`. */
export type Events = {
  $pageview: Record<string, never>;
  coin_picked: { from: string; to: string };
  interval_changed: { interval: string };
  drawing_added: { kind: string };
  indicator_added: { kind: string };
  replay_started: Record<string, never>;
  backtest_run: { ok: boolean; trades?: number; error?: string };
  coinbase_requested: Record<string, never>;
  sign_in_clicked: Record<string, never>;
  stratdeck_clicked: Record<string, never>;
};

type Send = (event: string, properties: Record<string, unknown>, at: Date) => void;

/** Events from before PostHog has loaded; it loads once the page has settled.
    Each keeps the page and time it happened at, not those of the send. */
const waiting: [string, Record<string, unknown>, Date][] = [];
const MAX_WAITING = 50;
let send: Send | null = null;

/** An address without its query or fragment: a link from elsewhere can carry
    anything there, an email address included. */
export function withoutQuery(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.split(/[?#]/)[0];
  }
}

const ADDRESSES = ["$current_url", "$referrer", "$initial_referrer"];

/** Every address an event carries, cut to its page. */
export const pagesOnly: BeforeSendFn = (event) => {
  if (!event) return event;
  const properties = { ...event.properties };
  for (const key of ADDRESSES) if (key in properties) properties[key] = withoutQuery(properties[key]);
  return { ...event, properties };
};

/** A reader who has asked not to be tracked (Do Not Track, or Global Privacy
    Control) isn't counted at all. PostHog's cookieless mode ignores both, so
    the site checks them itself. */
export function readerOptedOut(): boolean {
  const navigator = window.navigator as Navigator & { globalPrivacyControl?: boolean };
  return navigator?.doNotTrack === "1" || navigator?.globalPrivacyControl === true;
}

/**
 * Counts what visits do, anonymously: PostHog's cookieless mode keeps nothing
 * on the reader's device and works out daily visitors on its own servers from
 * a hash it never stores. No clicks, page text, recordings or person profiles
 * are collected; only the events above, with addresses cut to their page.
 */
export function analyticsConfig(): Partial<PostHogConfig> {
  return {
    api_host: INGEST_PATH,
    ui_host: "https://eu.posthog.com",
    cookieless_mode: "always",
    person_profiles: "identified_only",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_dead_clicks: false,
    rageclick: false,
    capture_exceptions: false,
    capture_heatmaps: false,
    capture_performance: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_web_experiments: true,
    disable_external_dependency_loading: true,
    // No feature flags or remote config: nothing is fetched but events sent.
    advanced_disable_flags: true,
    before_send: pagesOnly,
  };
}

const counted = () => window.location.hostname === COUNTED_HOST && !readerOptedOut();

/** Counts one event, now if PostHog has loaded, or once it has. */
export function track<Name extends keyof Events>(
  event: Name,
  ...[properties]: Events[Name] extends Record<string, never> ? [] : [Events[Name]]
): void {
  if (typeof window === "undefined" || !counted()) return;
  const { href, pathname } = window.location;
  const full = {
    ...properties,
    pair: pairForPath(pathname)?.id,
    $current_url: withoutQuery(href),
    $pathname: pathname,
  };
  if (send) send(event, full, new Date());
  else if (waiting.length < MAX_WAITING) waiting.push([event, full, new Date()]);
}

/** Loads PostHog, once, off the page's first load, then sends what waited. */
export async function startAnalytics(
  load: () => Promise<{ send: Send }> = loadPostHog,
): Promise<void> {
  if (send || !counted()) return;
  const loaded = await load();
  send = loaded.send;
  for (const [event, properties, at] of waiting.splice(0)) send(event, properties, at);
}

async function loadPostHog(): Promise<{ send: Send }> {
  const { default: posthog } = await import("posthog-js/dist/module.slim.no-external");
  posthog.init(KEY, analyticsConfig());
  posthog.register({ site: "cryptocharts" });
  return {
    send: (event, properties, at) => posthog.capture(event, properties, { timestamp: at }),
  };
}

/** Python's own exceptions: a failure is named only by one of these, never by
    a class the reader wrote, whose name is their own code. */
const PYTHON_ERRORS = new Set([
  "ArithmeticError", "AssertionError", "AttributeError", "BufferError", "EOFError",
  "Exception", "FloatingPointError", "ImportError", "IndentationError", "IndexError",
  "KeyError", "KeyboardInterrupt", "LookupError", "MemoryError", "ModuleNotFoundError",
  "NameError", "NotImplementedError", "OSError", "OverflowError", "RecursionError",
  "ReferenceError", "RuntimeError", "StopIteration", "SyntaxError", "SystemError",
  "TabError", "TypeError", "UnboundLocalError", "UnicodeDecodeError",
  "UnicodeEncodeError", "UnicodeError", "ValueError", "ZeroDivisionError",
]);

/** What sort of failure a backtest met, never its text: a script's error can
    quote the reader's own code. A Python error is named by its class alone,
    read from the traceback's last line, and only if it is one of Python's. */
export function backtestErrorKind(result: { error: string }): string {
  const { error } = result;
  if (/^Stopped: the script ran for longer/.test(error)) return "time_limit";
  if (/^(Stopped\.|Replaced by a newer run)/.test(error)) return "stopped";
  if (/^Python (couldn't start|took too long)/.test(error)) return "python_start";
  if (/took too long to load|^Couldn't load /.test(error)) return "package";
  if (/isn't a result/.test(error)) return "bad_result";
  const last = error.trim().split("\n").at(-1) ?? "";
  const name = /^(\w+)(?::|$)/.exec(last.trim())?.[1];
  return name && PYTHON_ERRORS.has(name) ? name : "script";
}
