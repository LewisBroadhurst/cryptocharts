// @vitest-isolate
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const at = (hostname: string, pathname = "/") =>
  vi.stubGlobal("window", { location: { hostname, pathname } });

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function fresh() {
  return import("@/lib/analytics/analytics");
}

describe("counting", () => {
  it("keeps what happens before PostHog loads, then sends it with the coin it happened on", async () => {
    const { startAnalytics, track } = await fresh();
    at("cryptocharts.stratdeck.uk", "/solana");
    track("interval_changed", { interval: "4h" });
    track("replay_started");

    const send = vi.fn();
    await startAnalytics(async () => ({ send }));
    expect(send.mock.calls).toEqual([
      ["interval_changed", { interval: "4h", pair: "SOL-USD" }],
      ["replay_started", { pair: "SOL-USD" }],
    ]);

    track("coin_picked", { from: "SOL-USD", to: "ETH-USD" });
    expect(send).toHaveBeenLastCalledWith("coin_picked", {
      from: "SOL-USD",
      to: "ETH-USD",
      pair: "SOL-USD",
    });
  });

  it("counts nothing, and loads nothing, anywhere but the live site", async () => {
    const { startAnalytics, track } = await fresh();
    at("localhost");
    track("replay_started");
    const load = vi.fn(async () => ({ send: vi.fn() }));
    await startAnalytics(load);
    expect(load).not.toHaveBeenCalled();

    at("cryptocharts-git-branch.vercel.app");
    await startAnalytics(load);
    expect(load).not.toHaveBeenCalled();
  });

  it("holds at most fifty events while PostHog loads", async () => {
    const { startAnalytics, track } = await fresh();
    at("cryptocharts.stratdeck.uk");
    for (let i = 0; i < 80; i++) track("replay_started");
    const send = vi.fn();
    await startAnalytics(async () => ({ send }));
    expect(send).toHaveBeenCalledTimes(50);
  });
});

describe("PostHog's settings", () => {
  it("keep nothing on the device and collect only the events the site sends", async () => {
    const { analyticsConfig } = await fresh();
    expect(analyticsConfig()).toMatchObject({
      api_host: "/ingest",
      cookieless_mode: "always",
      person_profiles: "identified_only",
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      disable_external_dependency_loading: true,
      advanced_disable_feature_flags: true,
    });
  });
});

describe("backtestErrorKind", () => {
  it("names the sort of failure, never the script's own words", async () => {
    const { backtestErrorKind } = await fresh();
    const kind = (error: string) => backtestErrorKind({ error });
    expect(kind("Stopped: the script ran for longer than 20 seconds.")).toBe("time_limit");
    expect(kind("Stopped.")).toBe("stopped");
    expect(kind("Replaced by a newer run.")).toBe("stopped");
    expect(kind("Python couldn't start in this browser.")).toBe("python_start");
    expect(kind("Python took too long to load. Try again.")).toBe("python_start");
    expect(kind("Couldn't load pandas. 404")).toBe("package");
    expect(kind("The script sent back something that isn't a result.")).toBe("bad_result");
    expect(
      kind('Traceback (most recent call last):\n  File "<exec>", line 3\n    secret = "my api key"\nNameError: name \'x\' is not defined'),
    ).toBe("NameError");
    expect(kind("something odd")).toBe("script");
  });
});
