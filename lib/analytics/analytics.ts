import type { PostHogConfig } from "posthog-js/dist/module.slim.no-external";

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

type Send = (event: string, properties: Record<string, unknown>) => void;

/** Events from before PostHog has loaded; it loads once the page has settled. */
const waiting: [string, Record<string, unknown>][] = [];
const MAX_WAITING = 50;
let send: Send | null = null;

/**
 * Counts what visits do, anonymously: PostHog's cookieless mode keeps nothing
 * on the reader's device and works out daily visitors on its own servers from
 * a hash it never stores. No clicks, page text, recordings or person profiles
 * are collected; only the events above.
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
    advanced_disable_feature_flags: true,
    respect_dnt: true,
  };
}

/** Counts one event, now if PostHog has loaded, or once it has. */
export function track<Name extends keyof Events>(
  event: Name,
  ...[properties]: Events[Name] extends Record<string, never> ? [] : [Events[Name]]
): void {
  if (typeof window === "undefined" || window.location.hostname !== COUNTED_HOST) return;
  const full = { ...properties, pair: pairForPath(window.location.pathname)?.id };
  if (send) send(event, full);
  else if (waiting.length < MAX_WAITING) waiting.push([event, full]);
}

/** Loads PostHog, once, off the page's first load, then sends what waited. */
export async function startAnalytics(
  load: () => Promise<{ send: Send }> = loadPostHog,
): Promise<void> {
  if (send || window.location.hostname !== COUNTED_HOST) return;
  const loaded = await load();
  send = loaded.send;
  for (const [event, properties] of waiting.splice(0)) send(event, properties);
}

async function loadPostHog(): Promise<{ send: Send }> {
  const { default: posthog } = await import("posthog-js/dist/module.slim.no-external");
  posthog.init(KEY, analyticsConfig());
  posthog.register({ site: "cryptocharts" });
  return { send: (event, properties) => posthog.capture(event, properties) };
}

/** What sort of failure a backtest met, never its text: a script's error can
    quote the reader's own code. A Python error is named by its class alone. */
export function backtestErrorKind(result: { error: string }): string {
  const { error } = result;
  if (/^Stopped: the script ran for longer/.test(error)) return "time_limit";
  if (/^(Stopped\.|Replaced by a newer run)/.test(error)) return "stopped";
  if (/^Python (couldn't start|took too long)/.test(error)) return "python_start";
  if (/took too long to load|^Couldn't load /.test(error)) return "package";
  if (/isn't a result/.test(error)) return "bad_result";
  return /\b([A-Z]\w*(?:Error|Exception))\b/.exec(error)?.[1] ?? "script";
}
