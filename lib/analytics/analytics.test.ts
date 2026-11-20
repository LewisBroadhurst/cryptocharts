// @vitest-isolate
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const at = (hostname: string, pathname = "/", navigator: object = {}, search = "") =>
  vi.stubGlobal("window", {
    location: { hostname, pathname, href: `https://${hostname}${pathname}${search}` },
    navigator,
  });

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

    // The reader moves on before PostHog loads: what waited keeps its page.
    at("cryptocharts.stratdeck.uk", "/ethereum");
    const send = vi.fn();
    await startAnalytics(async () => ({ send }));
    const page = { pair: "SOL-USD", $current_url: "https://cryptocharts.stratdeck.uk/solana", $pathname: "/solana" };
    expect(send.mock.calls.map(([event, properties]) => [event, properties])).toEqual([
      ["interval_changed", { interval: "4h", ...page }],
      ["replay_started", page],
    ]);
    expect(send.mock.calls[0][2]).toBeInstanceOf(Date);

    track("coin_picked", { from: "ETH-USD", to: "XRP-USD" });
    expect(send.mock.lastCall?.[1]).toMatchObject({ from: "ETH-USD", to: "XRP-USD", pair: "ETH-USD" });
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

describe("a reader who asks not to be tracked", () => {
  it("isn't counted, by Do Not Track or Global Privacy Control", async () => {
    for (const navigator of [{ doNotTrack: "1" }, { globalPrivacyControl: true }]) {
      vi.resetModules();
      const { startAnalytics, track } = await fresh();
      at("cryptocharts.stratdeck.uk", "/", navigator);
      const send = vi.fn();
      track("replay_started");
      await startAnalytics(async () => ({ send }));
      expect(send).not.toHaveBeenCalled();
    }
  });
});

describe("addresses", () => {
  it("are sent as the page alone, never a link's query or fragment", async () => {
    const { pagesOnly, startAnalytics, track } = await fresh();
    at("cryptocharts.stratdeck.uk", "/ethereum", {}, "?utm_source=x&email=a%40b.com#top");
    const send = vi.fn();
    await startAnalytics(async () => ({ send }));
    track("replay_started");
    expect(send.mock.lastCall?.[1].$current_url).toBe("https://cryptocharts.stratdeck.uk/ethereum");

    const event = {
      uuid: "1",
      event: "$pageview",
      properties: {
        $current_url: "https://cryptocharts.stratdeck.uk/?gclid=1",
        $referrer: "https://www.google.com/search?q=my+name",
        $initial_referrer: "$direct",
        $search_engine: "google",
        ph_keyword: "my name",
      },
    };
    expect(pagesOnly(event as never)?.properties).toEqual({
      $current_url: "https://cryptocharts.stratdeck.uk/",
      $referrer: "https://www.google.com/search",
      $initial_referrer: "$direct",
      $search_engine: "google",
    });
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
      advanced_disable_flags: true,
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
    // The real error is the last line, not an earlier `except` in the code.
    expect(kind("  except ValueError:\n    pass\nKeyError: 'close'")).toBe("KeyError");
    // A class the reader wrote is their code: it isn't sent.
    expect(kind("Traceback ...\nMyKeyAbcError: nope")).toBe("script");
    expect(kind("something odd")).toBe("script");
  });
});
