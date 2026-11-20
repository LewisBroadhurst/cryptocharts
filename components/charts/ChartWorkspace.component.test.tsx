import { page, userEvent } from "vitest/browser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import "@/app/globals.css";
import ChartWorkspace from "@/components/charts/ChartWorkspace";

const HOUR = 3_600;
const START = Date.parse("2026-01-05T00:00:00Z") / 1000;

// One fixed run of hourly bars, the same array every render, as the hook keeps it.
const CANDLES = Array.from({ length: 120 }, (_, i) => {
  const close = 100 + 20 * Math.sin(i / 9);
  return {
    time: START + i * HOUR,
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
  };
});

vi.mock("@/hooks/useMarketBars", () => ({
  useMarketBars: () => ({
    candles: CANDLES,
    error: undefined,
    status: "live",
    loadOlder: async () => {},
    loadingOlder: false,
  }),
}));

const SAVED = "cryptocharts.drawings.v1:BTC-USD";
const picked = vi.fn();
const saved = () => JSON.parse(localStorage.getItem(SAVED) ?? "[]");

function pane() {
  const host = document.querySelector<HTMLElement>(".touch-none")!;
  return host.getBoundingClientRect();
}

async function tap(fx: number, fy: number, shiftKey = false) {
  const box = pane();
  const x = box.left + box.width * 0.8 * fx;
  const y = box.top + box.height * fy;
  const target = document.elementFromPoint(x, y)!;
  const init = {
    bubbles: true,
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    shiftKey,
  };
  target.dispatchEvent(new PointerEvent("pointerdown", init));
  target.dispatchEvent(new PointerEvent("pointerup", init));
}

async function mount() {
  await page.viewport(1200, 800);
  const screen = await render(
    <ChartWorkspace initialPair="BTC-USD" onPickPair={picked} />,
  );
  await vi.waitFor(() =>
    expect(document.querySelectorAll("canvas").length).toBeGreaterThan(2),
  );
  await expect
    .element(screen.getByText(/^Loading BTC-USD/))
    .not.toBeInTheDocument();
  return screen;
}

describe("ChartWorkspace", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("draws a trend line from two taps, picks it, and removes it with Delete", async () => {
    const screen = await mount();

    await screen.getByRole("button", { name: "Trend line" }).click();
    await tap(0.2, 0.7);
    await tap(0.6, 0.3);

    expect(saved()).toHaveLength(1);
    expect(saved()[0].kind).toBe("trend");
    await expect
      .element(screen.getByRole("toolbar", { name: "Trend line settings" }))
      .toBeVisible();

    await userEvent.keyboard("{Delete}");
    expect(saved()).toEqual([]);

    await userEvent.keyboard("{Control>}z{/Control}");
    expect(saved()).toHaveLength(1);
  });

  it("keeps a line level when Shift is held on its second tap", async () => {
    const screen = await mount();
    await screen.getByRole("button", { name: "Trend line" }).click();
    await tap(0.2, 0.7);
    await tap(0.6, 0.3, true);

    const [line] = saved();
    expect(line.points[1].price).toBe(line.points[0].price);
  });

  it("keeps hidden drawings when a new one is drawn", async () => {
    const screen = await mount();
    await screen.getByRole("button", { name: "Trend line" }).click();
    await tap(0.2, 0.7);
    await tap(0.6, 0.3);
    await userEvent.keyboard("{Escape}");
    await screen.getByRole("button", { name: "Hide all drawings" }).click();

    await screen.getByRole("button", { name: "More lines" }).click();
    await screen
      .getByRole("group", { name: "Lines" })
      .getByRole("button", { name: /Horizontal line/ })
      .click();
    await tap(0.5, 0.5);

    expect(saved().map((one: { kind: string }) => one.kind)).toEqual([
      "trend",
      "horizontal",
    ]);
  });

  it("hands another coin to the page, and keeps drawings under the pair they were drawn on", async () => {
    picked.mockClear();
    const screen = await mount();
    await screen.getByRole("button", { name: "Trend line" }).click();
    await tap(0.2, 0.7);
    await tap(0.6, 0.3);
    await userEvent.keyboard("{Escape}");

    await screen.getByRole("button", { name: /^Pair: BTC-USD/ }).click();
    await userEvent.fill(screen.getByRole("textbox", { name: "Search coins" }), "eth");
    await screen.getByRole("button", { name: /ETH/ }).click();
    expect(picked).toHaveBeenCalledOnce();
    expect(picked.mock.calls[0][0].id).toBe("ETH-USD");

    expect(saved()).toHaveLength(1);
    expect(localStorage.getItem("cryptocharts.drawings.v1:ETH-USD")).toBeNull();
  });

  it("places a long position in one tap, opening at two to one", async () => {
    const screen = await mount();

    await screen.getByRole("button", { name: "More positions" }).click();
    await screen
      .getByRole("group", { name: "Positions" })
      .getByRole("button", { name: /Long position/ })
      .click();
    await tap(0.5, 0.5);

    const [long] = saved();
    const entry = long.points[0].price;
    expect(long.kind).toBe("long");
    expect((long.target - entry) / (entry - long.stop)).toBeCloseTo(2);
  });

  it("adds an EMA of any length from the indicators dialog", async () => {
    const screen = await mount();

    await screen.getByRole("button", { name: "Indicators" }).click();
    await userEvent.fill(
      screen.getByRole("textbox", { name: "Length", exact: true }),
      "34",
    );
    await screen.getByRole("button", { name: "Add", exact: true }).click();
    await userEvent.keyboard("{Escape}");

    await expect.element(screen.getByText("EMA 34")).toBeVisible();
  });

  it("puts RSI and MACD in panes of their own under the price, each with its legend line, and keeps them when one goes", async () => {
    const screen = await mount();
    const legendTop = () =>
      screen.getByText("MACD 12 26 9").element().getBoundingClientRect().top;

    await screen.getByRole("button", { name: "Indicators" }).click();
    await screen.getByRole("button", { name: "RSI 14" }).click();
    await screen.getByRole("button", { name: "MACD 12 26 9" }).click();
    await screen.getByRole("button", { name: "BB 20 2" }).click();
    await userEvent.keyboard("{Escape}");

    const rsi = screen.getByText("RSI 14");
    await expect.element(rsi).toBeVisible();
    await expect.element(screen.getByText("BB 20 2")).toBeVisible();
    const box = pane();
    const rsiTop = rsi.element().getBoundingClientRect().top;
    // The price keeps most of the room; the lower panes sit in the bottom half.
    expect(rsiTop).toBeGreaterThan(box.top + box.height / 2);
    await expect.poll(legendTop).toBeGreaterThan(rsiTop);

    const before = legendTop();
    await screen.getByRole("button", { name: "Remove RSI 14" }).click();
    await expect.element(screen.getByText("RSI 14")).not.toBeInTheDocument();
    await expect.poll(legendTop).toBeLessThan(before);

    const saved = JSON.parse(
      localStorage.getItem("cryptocharts.layout.v1") ?? "{}",
    );
    expect(
      saved.studies.map((study: { kind: string }) => study.kind),
    ).toContain("macd");
  });
});

describe("the chart's menus", () => {
  it("shut on a tap outside, and open again on the next tap of the trigger", async () => {
    const screen = await mount();
    const trigger = screen.getByRole("button", { name: "Chart style" });

    await trigger.click();
    await expect
      .element(screen.getByRole("group", { name: "Chart style" }))
      .toBeVisible();
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    await expect
      .element(screen.getByRole("group", { name: "Chart style" }))
      .not.toBeInTheDocument();

    await trigger.click();
    await expect
      .element(screen.getByRole("group", { name: "Chart style" }))
      .toBeVisible();
  });

  it("shut when a scroll moves the trigger", async () => {
    const screen = await render(
      <div style={{ height: 3000 }}>
        <ChartWorkspace initialPair="BTC-USD" onPickPair={picked} />
      </div>,
    );
    await screen.getByRole("button", { name: "Chart style" }).click();
    await expect
      .element(screen.getByRole("group", { name: "Chart style" }))
      .toBeVisible();

    window.scrollBy(0, 200);
    window.dispatchEvent(new Event("scroll"));

    await expect
      .element(screen.getByRole("group", { name: "Chart style" }))
      .not.toBeInTheDocument();
  });
});

describe("the chart's exchange menu", () => {
  it("shows Coinbase locked, and picking it leaves the chart on Kraken", async () => {
    const screen = await mount();
    await screen.getByRole("button", { name: /^Exchange: Kraken/ }).click();
    const coinbase = screen.getByRole("button", { name: "Coinbase: coming soon" });
    await expect.element(coinbase).toHaveAttribute("aria-disabled", "true");

    await coinbase.click({ force: true });
    await expect
      .element(screen.getByRole("button", { name: /^Exchange: Kraken/ }))
      .toBeVisible();
    // Kraken is the default, so the address doesn't name it.
    expect(new URL(window.location.href).searchParams.get("ex")).toBeNull();
  });
});

describe("the chart's replay", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  async function clickBar(fx: number) {
    const host = document.querySelector<HTMLElement>(".touch-none > div")!;
    const box = host.getBoundingClientRect();
    await userEvent.click(page.elementLocator(host), {
      position: { x: box.width * fx, y: box.height / 2 },
    });
  }
  const shownTime = () =>
    document.querySelector('[role="toolbar"][aria-label="Replay"] p')?.textContent ?? "";

  it("starts at a picked bar, steps one bar at a time, and goes back to live", async () => {
    const screen = await mount();
    const newest = CANDLES.at(-1)!.close.toFixed(2);
    // The legend shows the bar under the pointer, so read it with the pointer off the chart.
    const legend = () => screen.getByRole("toolbar", { name: "Chart" }).element()
      .parentElement!.textContent!;
    const offChart = () =>
      userEvent.hover(screen.getByRole("button", { name: "Indicators" }));
    await offChart();
    await expect.poll(legend).toContain(newest);
    await screen.getByRole("button", { name: "Replay", exact: true }).click();
    await expect.element(screen.getByText(/Click a bar to replay/)).toBeVisible();

    await clickBar(0.4);
    await offChart();
    // The newest bar is out of sight, and so out of the legend.
    await expect.poll(legend).not.toContain(newest);
    const bar = screen.getByRole("toolbar", { name: "Replay" });
    await expect.element(bar).toBeVisible();
    await expect.element(screen.getByText(/Click a bar to replay/)).not.toBeInTheDocument();
    const start = shownTime();
    expect(start).toMatch(/\d{2}:\d{2}/);

    await screen.getByRole("button", { name: "Forward one bar" }).click();
    await expect.poll(shownTime).not.toBe(start);
    await screen.getByRole("button", { name: "Back one bar" }).click();
    await expect.poll(shownTime).toBe(start);

    await screen.getByRole("button", { name: "Back to live" }).click();
    await expect.element(bar).not.toBeInTheDocument();
    await offChart();
    await expect.poll(legend).toContain(newest);
  });

  it("plays forward on its own, and pauses", async () => {
    const screen = await mount();
    await screen.getByRole("button", { name: "Replay", exact: true }).click();
    await clickBar(0.4);
    const start = shownTime();

    await screen.getByRole("button", { name: "10 bars a second" }).click();
    await screen.getByRole("button", { name: "Play" }).click();
    await expect.poll(shownTime).not.toBe(start);
    await screen.getByRole("button", { name: "Pause" }).click();
    const paused = shownTime();
    await new Promise((done) => setTimeout(done, 400));
    expect(shownTime()).toBe(paused);
  });

  it("forgets the pick when Escape is pressed", async () => {
    const screen = await mount();
    await screen.getByRole("button", { name: "Replay", exact: true }).click();
    await expect.element(screen.getByText(/Click a bar to replay/)).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByText(/Click a bar to replay/)).not.toBeInTheDocument();
    await clickBar(0.4);
    await expect
      .element(screen.getByRole("toolbar", { name: "Replay" }))
      .not.toBeInTheDocument();
  });
});

describe("the chart's full screen", () => {
  it("fills the screen with the chart and its tips, and gives the screen back", async () => {
    const screen = await mount();
    const toolbar = screen.getByRole("toolbar", { name: "Chart" });

    await screen.getByRole("button", { name: "Full screen" }).click();
    await expect
      .poll(() => document.fullscreenElement?.contains(toolbar.element()))
      .toBe(true);

    await screen.getByRole("button", { name: "Undo" }).hover();
    const tip = screen.getByRole("tooltip");
    await expect.element(tip).toHaveTextContent("Undo");
    expect(document.fullscreenElement?.contains(tip.element())).toBe(true);

    await screen.getByRole("button", { name: "Exit full screen" }).click();
    await expect.poll(() => document.fullscreenElement).toBeNull();
    await expect
      .element(screen.getByRole("button", { name: "Full screen" }))
      .toBeVisible();
  });
});
