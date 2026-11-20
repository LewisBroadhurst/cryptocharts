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
  await expect(page.getByText("Live", { exact: true })).toBeAttached({ timeout: 30_000 });
}

test("Bitcoin loads from Kraken and goes live", async ({ page }) => {
  const blocked = watchPolicy(page);
  await page.goto("/");
  await expectChart(page, "BTC-USD");
  expect(blocked).toEqual([]);
});

test("Ethereum's page loads its chart, with a heading and text a search engine can read", async ({ page }) => {
  const blocked = watchPolicy(page);
  await page.goto("/ethereum");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ethereum (ETH) live chart");
  await expect(page.getByRole("heading", { name: "About Ethereum (ETH)" })).toBeAttached();
  await expectChart(page, "ETH-USD");
  expect(blocked).toEqual([]);
});

test("an old link to a coin goes to its page for good, and the address tidies", async ({ page }) => {
  const response = await page.request.get("/?pair=eth-usd&ex=kraken", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toMatch(/^\/ethereum\?/);

  await page.goto("/?pair=ETH-USD&ex=kraken");
  await expectChart(page, "ETH-USD");
  await expect(page).toHaveURL(/\/ethereum$/);
});

test("picking another coin goes to its page", async ({ page }) => {
  await page.goto("/");
  await expectChart(page, "BTC-USD");
  await page.getByRole("button", { name: /^Pair: BTC-USD/ }).click();
  await page.getByRole("textbox", { name: "Search coins" }).fill("sol");
  await page.getByRole("button", { name: /SOL/ }).click();
  await expect(page).toHaveURL(/\/solana$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Solana (SOL) live chart");
  await expectChart(page, "SOL-USD");

  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bitcoin (BTC) live chart");
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
