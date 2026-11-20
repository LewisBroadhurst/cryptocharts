// Runs the built site against the real exchanges: the one check that the
// whole path (fetch, WebSocket, the page's security policy) works for a reader.
import { expect, test, type Page } from "@playwright/test";

function watchPolicy(page: Page) {
  const blocked: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) blocked.push(message.text());
  });
  return blocked;
}

async function expectChart(page: Page, pair: string, exchange: string) {
  await expect(page.getByText(`Loading ${pair} from ${exchange}`)).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.getByText(/Couldn't load/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: exchange })).toBeVisible();
  await expect(page.getByText("Live")).toBeAttached({ timeout: 30_000 });
}

test("Bitcoin loads from Coinbase and goes live", async ({ page }) => {
  const blocked = watchPolicy(page);
  await page.goto("/");
  await expectChart(page, "BTC-USD", "Coinbase");
  expect(blocked).toEqual([]);
});

test("Ethereum loads from Kraken from a shared link", async ({ page }) => {
  const blocked = watchPolicy(page);
  await page.goto("/?pair=ETH-USD&ex=kraken");
  await expectChart(page, "ETH-USD", "Kraken");
  expect(blocked).toEqual([]);
});

test("the four-hour and weekly bars, built from smaller ones, load", async ({ page }) => {
  await page.goto("/");
  await expectChart(page, "BTC-USD", "Coinbase");
  for (const interval of ["4h", "1W"]) {
    await page.getByRole("button", { name: interval, exact: true }).click();
    await expect(page.getByText(/Couldn't load/)).toHaveCount(0);
    await expect(page.getByText("Loading BTC-USD from Coinbase")).toHaveCount(0, {
      timeout: 30_000,
    });
  }
});
