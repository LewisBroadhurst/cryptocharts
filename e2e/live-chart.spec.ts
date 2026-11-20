// Runs the built site against the real exchange: the one check that the whole
// path (fetch, WebSocket, the page's security policy) works for a reader.
import { expect, test, type Page } from "@playwright/test";

function watchPolicy(page: Page) {
  const blocked: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) blocked.push(message.text());
  });
  return blocked;
}

async function expectChart(page: Page, pair: string) {
  await expect(page.getByText(`Loading ${pair} from Kraken`)).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.getByText(/Couldn't load/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Kraken" })).toBeVisible();
  await expect(page.getByText("Live")).toBeAttached({ timeout: 30_000 });
}

test("Bitcoin loads from Kraken and goes live", async ({ page }) => {
  const blocked = watchPolicy(page);
  await page.goto("/");
  await expectChart(page, "BTC-USD");
  expect(blocked).toEqual([]);
});

test("a shared link to Ethereum loads it", async ({ page }) => {
  await page.goto("/?pair=ETH-USD&ex=kraken");
  await expectChart(page, "ETH-USD");
});

test("an old link to Coinbase opens on Kraken and never calls Coinbase", async ({ page }) => {
  const coinbase: string[] = [];
  page.on("request", (request) => {
    if (/coinbase\.com/.test(request.url())) coinbase.push(request.url());
  });
  await page.goto("/?pair=BTC-USD&ex=coinbase");
  await expectChart(page, "BTC-USD");
  expect(coinbase).toEqual([]);
});

test("every interval loads", async ({ page }) => {
  await page.goto("/");
  await expectChart(page, "BTC-USD");
  for (const interval of ["1m", "4h", "1W"]) {
    await page.getByRole("button", { name: interval, exact: true }).click();
    await expect(page.getByText("Loading BTC-USD from Kraken")).toHaveCount(0, {
      timeout: 30_000,
    });
    await expect(page.getByText(/Couldn't load/)).toHaveCount(0);
  }
});
