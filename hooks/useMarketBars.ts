"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { intervalSeconds, type Interval } from "@/lib/charts/bars";
import type { Candle } from "@/lib/data/chart-data";
import { applyTrade, mergeBars } from "@/lib/market/buckets";
import type { Pair } from "@/lib/market/pairs";
import {
  SOURCES,
  type Exchange,
  type LiveStatus,
  type LiveUpdate,
} from "@/lib/market/sources";

/** Live updates are drawn at most this often; trades arrive many times a second. */
const DRAW_EVERY_MS = 250;

type Shown = { key: string; candles: Candle[]; error?: string };

/**
 * A pair's bars on one exchange: history first, then kept current from the
 * exchange's live feed. Older bars load on request where the exchange has them.
 */
export function useMarketBars(pair: Pair, interval: Interval, exchange: Exchange) {
  const key = `${exchange}:${pair.id}:${interval}`;
  const [shown, setShown] = useState<Shown>({ key, candles: [] });
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [older, setOlder] = useState<{ key: string; loading: boolean; done: boolean }>({
    key,
    loading: false,
    done: false,
  });
  const bars = useRef<Candle[]>([]);
  const live = useRef({ key, loaded: false });

  useEffect(() => {
    const source = SOURCES[exchange];
    const seconds = intervalSeconds(interval);
    const abort = new AbortController();
    const buffered: LiveUpdate[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reopened = false;
    bars.current = [];
    live.current = { key, loaded: false };

    const apply = (update: LiveUpdate) => {
      const run = bars.current;
      if ("trade" in update) {
        applyTrade(run, update.trade, seconds);
        return;
      }
      const last = run.at(-1);
      if (!last || update.bar.time > last.time) run.push(update.bar);
      else if (update.bar.time === last.time) run[run.length - 1] = update.bar;
    };
    const draw = () => {
      timer = undefined;
      if (!abort.signal.aborted) setShown({ key, candles: [...bars.current] });
    };
    const drawSoon = () => {
      timer ??= setTimeout(draw, DRAW_EVERY_MS);
    };

    const loadNewest = () =>
      source
        .history(pair, interval, undefined, abort.signal)
        .then((fetched) => {
          bars.current = mergeBars(bars.current, fetched);
          for (const update of buffered.splice(0)) apply(update);
          live.current.loaded = true;
          draw();
        })
        .catch((problem: unknown) => {
          if (abort.signal.aborted) return;
          setShown({
            key,
            candles: [...bars.current],
            error:
              problem instanceof Error
                ? problem.message
                : "The exchange didn't answer",
          });
        });

    void loadNewest();
    const stop = source.live(
      pair,
      interval,
      (update) => {
        if (!live.current.loaded) {
          buffered.push(update);
          return;
        }
        apply(update);
        drawSoon();
      },
      (next) => {
        setStatus(next);
        if (next === "reconnecting") reopened = true;
        // Bars missed while the feed was down come from history.
        if (next === "live" && reopened) {
          reopened = false;
          void loadNewest();
        }
      },
    );
    return () => {
      abort.abort();
      stop();
      clearTimeout(timer);
    };
    // `key` names exactly the pair, interval and exchange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Older-bar state from another pair or interval doesn't count here.
  const olderNow = useMemo(
    () =>
      older.key === key
        ? older
        : { key, loading: false, done: !SOURCES[exchange].pagesBack },
    [older, key, exchange],
  );

  const loadOlder = useCallback(async () => {
    const source = SOURCES[exchange];
    if (!source.pagesBack || olderNow.loading || olderNow.done) return;
    const oldest = bars.current[0]?.time;
    if (oldest === undefined) return;
    setOlder({ key, loading: true, done: false });
    try {
      const fetched = await source.history(pair, interval, oldest);
      if (live.current.key !== key) return;
      bars.current = mergeBars(fetched, bars.current);
      setShown({ key, candles: [...bars.current] });
      setOlder({ key, loading: false, done: fetched.length === 0 });
    } catch {
      if (live.current.key === key) setOlder({ key, loading: false, done: false });
    }
  }, [exchange, pair, interval, key, olderNow]);

  const current = shown.key === key;
  return {
    candles: current ? shown.candles : [],
    error: current ? shown.error : undefined,
    status,
    loadOlder,
    loadingOlder: olderNow.loading,
  };
}
