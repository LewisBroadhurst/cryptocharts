"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { readResult, type BacktestResult } from "@/lib/backtest/engine";
import type { Candle } from "@/lib/data/chart-data";

export type SandboxStatus = "off" | "loading" | "ready" | "running" | "failed";

/** A script that runs longer than this is stopped. */
export const RUN_LIMIT_MS = 30_000;
/** Pyodide is about 12 MB; on a slow connection it takes a while to arrive. */
const LOAD_LIMIT_MS = 90_000;

type Job = { code: string; bars: Candle[]; fee: number; slippage: number };

const failure = (error: string): BacktestResult => ({ ok: false, error, log: [] });

/**
 * Runs backtests in the sandbox frame (app/sandbox/route.ts). The frame is
 * made on first use and kept for the next run, since Pyodide takes a few
 * seconds to start. Stopping a run removes the frame, which ends its worker
 * whatever the script is doing.
 */
export function useBacktestSandbox() {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const waiting = useRef<{
    id: number;
    job: Job;
    done: (result: BacktestResult) => void;
    timer?: ReturnType<typeof setTimeout>;
  } | null>(null);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nextId = useRef(1);
  const [status, setStatus] = useState<SandboxStatus>("off");
  const [problem, setProblem] = useState<string | null>(null);
  /** Packages the running script imports that are downloading, e.g. ["numpy"]. */
  const [packages, setPackages] = useState<string[] | null>(null);

  const settle = useCallback((result: BacktestResult) => {
    const job = waiting.current;
    if (!job) return;
    clearTimeout(job.timer);
    waiting.current = null;
    setPackages(null);
    job.done(result);
  }, []);

  const remove = useCallback(() => {
    clearTimeout(loadTimer.current);
    frame.current?.remove();
    frame.current = null;
  }, []);

  /** Gives up on the waiting job, and ends its worker, after `ms`. */
  const limit = useCallback(
    (ms: number, error: string) => {
      const job = waiting.current;
      if (!job) return;
      clearTimeout(job.timer);
      job.timer = setTimeout(() => {
        remove();
        setStatus("off");
        settle(failure(error));
      }, ms);
    },
    [remove, settle],
  );

  const runLimit = useCallback(
    () =>
      limit(RUN_LIMIT_MS, `Stopped: the script ran for longer than ${RUN_LIMIT_MS / 1000} seconds.`),
    [limit],
  );

  const send = useCallback(() => {
    const job = waiting.current;
    const target = frame.current?.contentWindow;
    if (!job || !target) return;
    setStatus("running");
    // The frame's origin is opaque, so "*" is the only target that reaches it.
    // What goes there is the script and public prices: nothing private.
    target.postMessage({ type: "run", id: job.id, ...job.job }, "*");
    runLimit();
  }, [runLimit]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Only the frame we made, and only messages we expect from it.
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const data = event.data as {
        type?: unknown;
        id?: unknown;
        result?: unknown;
        error?: unknown;
        names?: unknown;
      };
      const current = data?.id !== undefined && data.id === waiting.current?.id;
      if (data?.type === "ready") {
        clearTimeout(loadTimer.current);
        setStatus("ready");
        send();
      } else if (data?.type === "failed") {
        remove();
        setStatus("failed");
        setProblem("Python couldn't start in this browser.");
        settle(failure("Python couldn't start in this browser."));
      } else if (data?.type === "packages" && current) {
        // Downloading counts against the load limit, not the script's.
        const names = Array.isArray(data.names) ? data.names.map(String) : [];
        setPackages(names);
        limit(LOAD_LIMIT_MS, `${names.join(", ")} took too long to load. Try again.`);
      } else if (data?.type === "started" && current) {
        setPackages(null);
        runLimit();
      } else if (data?.type === "result") {
        setStatus("ready");
        if (data.id === waiting.current?.id)
          settle(
            readResult(data.result) ??
              failure("The script sent back something that isn't a result."),
          );
        // An older run finished; one asked for since is still to send.
        else send();
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      remove();
    };
  }, [limit, remove, runLimit, send, settle]);

  /** Starts Python in the background, so the first run doesn't wait for it. */
  const warm = useCallback(() => {
    if (frame.current) return;
    setProblem(null);
    setStatus("loading");
    const made = document.createElement("iframe");
    made.sandbox.add("allow-scripts");
    made.src = "/sandbox";
    made.title = "Backtest sandbox";
    made.hidden = true;
    made.dataset.backtestSandbox = "";
    document.body.append(made);
    frame.current = made;
    loadTimer.current = setTimeout(() => {
      remove();
      setStatus("failed");
      setProblem("Python took too long to load. Try again.");
      settle(failure("Python took too long to load. Try again."));
    }, LOAD_LIMIT_MS);
  }, [remove, settle]);

  const run = useCallback(
    (job: Job) =>
      new Promise<BacktestResult>((done) => {
        settle(failure("Replaced by a newer run."));
        waiting.current = { id: nextId.current++, job, done };
        if (!frame.current) warm();
        else if (status === "ready") send();
      }),
    [send, settle, status, warm],
  );

  const stop = useCallback(() => {
    remove();
    setStatus("off");
    settle(failure("Stopped."));
  }, [remove, settle]);

  return { status, problem, packages, warm, run, stop };
}
