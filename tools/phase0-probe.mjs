// Phase 0 probe: what Coinbase and Kraken let a browser page do.
// Runs on GitHub Actions (Node 22: global fetch and WebSocket). No keys, no dependencies.
// Writes out/results.json, out/summary.md and the raw terms pages to out/terms/.

import { mkdir, writeFile } from "node:fs/promises";

const ORIGIN = "https://cryptocharts.stratdeck.uk";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const DAY = 86_400;
const now = () => Math.floor(Date.now() / 1000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (s) => new Date(s * 1000).toISOString();

await mkdir("out/terms", { recursive: true });
const results = { ranAt: new Date().toISOString(), cors: [], depth: [], streams: [], terms: [] };

async function get(url, headers = {}) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Origin: ORIGIN, ...headers } });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, headers: res.headers, text, json };
}

// 1. CORS: would a page on our domain be allowed to read these responses?
const t = now();
const corsTargets = [
  ["Coinbase Exchange candles", "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60"],
  [
    "Coinbase Advanced Trade public candles",
    `https://api.coinbase.com/api/v3/brokerage/market/products/BTC-USD/candles?granularity=ONE_MINUTE&start=${t - 3600}&end=${t}`,
  ],
  ["Kraken OHLC", "https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1"],
];
for (const [name, url] of corsTargets) {
  try {
    const r = await get(url);
    const pre = await fetch(url, {
      method: "OPTIONS",
      headers: { Origin: ORIGIN, "Access-Control-Request-Method": "GET", "User-Agent": UA },
    }).catch(() => null);
    results.cors.push({
      name,
      status: r.status,
      allowOrigin: r.headers.get("access-control-allow-origin"),
      preflightStatus: pre?.status ?? null,
      preflightAllowOrigin: pre?.headers.get("access-control-allow-origin") ?? null,
      sample: r.text.slice(0, 200),
    });
  } catch (e) {
    results.cors.push({ name, error: String(e) });
  }
}

// 2. History depth.
// Coinbase Exchange: 300 candles per request. Binary-search the oldest age that still returns data.
async function coinbaseHas(granularity, endSecs) {
  const start = endSecs - granularity * 300;
  const r = await get(
    `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=${granularity}&start=${iso(start)}&end=${iso(endSecs)}`,
  );
  await sleep(250);
  return Array.isArray(r.json) && r.json.length > 0;
}
for (const [label, g] of [["1m", 60], ["1h", 3600], ["1d", 86400]]) {
  try {
    let lo = 0;
    let hi = 6000; // days back
    if (await coinbaseHas(g, now() - hi * DAY)) {
      results.depth.push({ exchange: "Coinbase", interval: label, oldestDaysBack: `>${hi}` });
      continue;
    }
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (await coinbaseHas(g, now() - mid * DAY)) lo = mid;
      else hi = mid;
    }
    results.depth.push({
      exchange: "Coinbase",
      interval: label,
      perRequest: 300,
      oldestDaysBack: lo,
      oldestDate: iso(now() - lo * DAY).slice(0, 10),
    });
  } catch (e) {
    results.depth.push({ exchange: "Coinbase", interval: label, error: String(e) });
  }
}
// Kraken: OHLC returns at most 720 bars, newest last, whatever `since` asks for. Check both.
for (const [label, i] of [["1m", 1], ["1h", 60], ["1d", 1440]]) {
  for (const since of [0, now() - 3 * 365 * DAY]) {
    try {
      const r = await get(`https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=${i}&since=${since}`);
      const key = Object.keys(r.json?.result ?? {}).find((k) => k !== "last");
      const rows = key ? r.json.result[key] : [];
      results.depth.push({
        exchange: "Kraken",
        interval: label,
        askedSince: since ? iso(since).slice(0, 10) : "0",
        bars: rows.length,
        first: rows[0] ? iso(rows[0][0]) : null,
        last: rows.at(-1) ? iso(rows.at(-1)[0]) : null,
        error: r.json?.error?.length ? r.json.error : undefined,
      });
      await sleep(1200);
    } catch (e) {
      results.depth.push({ exchange: "Kraken", interval: label, error: String(e) });
    }
  }
}

// 3. Live streams: which channels send candles or trades without an account?
function listen(name, url, subscribe, ms = 20_000) {
  return new Promise((resolve) => {
    const seen = {};
    const samples = {};
    let opened = false;
    let error = null;
    const ws = new WebSocket(url);
    const done = () => {
      try {
        ws.close();
      } catch {}
      resolve({ name, url, opened, error, messageCounts: seen, samples });
    };
    const timer = setTimeout(done, ms);
    ws.onopen = () => {
      opened = true;
      for (const msg of subscribe) ws.send(JSON.stringify(msg));
    };
    ws.onerror = (e) => {
      error = String(e?.message ?? e?.type ?? e);
    };
    ws.onclose = (e) => {
      if (!opened || Object.keys(seen).length === 0) {
        error = error ?? `closed ${e.code} ${e.reason}`;
        clearTimeout(timer);
        done();
      }
    };
    ws.onmessage = (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      const kind = m.channel ?? m.type ?? m.method ?? "unknown";
      seen[kind] = (seen[kind] ?? 0) + 1;
      if (!samples[kind] || (seen[kind] === 3 && kind !== "heartbeat")) samples[kind] = JSON.stringify(m).slice(0, 600);
    };
  });
}
results.streams.push(
  await listen("Coinbase Exchange feed", "wss://ws-feed.exchange.coinbase.com", [
    { type: "subscribe", product_ids: ["BTC-USD"], channels: ["ticker", "matches", "heartbeat"] },
  ]),
);
results.streams.push(
  await listen("Coinbase Advanced Trade (candles, no auth)", "wss://advanced-trade-ws.coinbase.com", [
    { type: "subscribe", product_ids: ["BTC-USD"], channel: "candles" },
    { type: "subscribe", product_ids: ["BTC-USD"], channel: "market_trades" },
  ]),
);
results.streams.push(
  await listen("Kraken v2 (ohlc 1m + trade)", "wss://ws.kraken.com/v2", [
    { method: "subscribe", params: { channel: "ohlc", symbol: ["BTC/USD"], interval: 1 } },
    { method: "subscribe", params: { channel: "trade", symbol: ["BTC/USD"] } },
  ]),
);

// 4. Terms pages, saved raw for reading.
const termsPages = [
  "https://www.coinbase.com/legal/market_data",
  "https://www.coinbase.com/legal/developer-platform/terms-of-service",
  "https://docs.cdp.coinbase.com/exchange/introduction/welcome",
  "https://www.kraken.com/legal",
  "https://www.kraken.com/legal/api-terms",
  "https://www.kraken.com/legal/market-data-terms",
  "https://www.kraken.com/legal/terms",
  "https://docs.kraken.com/api/",
];
for (const url of termsPages) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow" });
    const body = await res.text();
    const file = url.replace(/^https:\/\//, "").replace(/[^a-z0-9]+/gi, "_") + ".html";
    await writeFile(`out/terms/${file}`, body);
    results.terms.push({ url, status: res.status, finalUrl: res.url, bytes: body.length, file });
  } catch (e) {
    results.terms.push({ url, error: String(e) });
  }
}

await writeFile("out/results.json", JSON.stringify(results, null, 2));

const md = [
  "# Phase 0 probe",
  `Ran ${results.ranAt} on a GitHub-hosted runner.`,
  "## CORS (Origin: " + ORIGIN + ")",
  "| Endpoint | Status | Access-Control-Allow-Origin | Preflight |",
  "|---|---|---|---|",
  ...results.cors.map(
    (c) => `| ${c.name} | ${c.status ?? c.error} | ${c.allowOrigin ?? "none"} | ${c.preflightStatus ?? "-"} ${c.preflightAllowOrigin ?? ""} |`,
  ),
  "## History depth (BTC/USD)",
  "| Exchange | Interval | Result |",
  "|---|---|---|",
  ...results.depth.map((d) => `| ${d.exchange} | ${d.interval} | ${JSON.stringify({ ...d, exchange: undefined, interval: undefined })} |`),
  "## Live streams (20 s each)",
  ...results.streams.map((s) => `- **${s.name}**: opened ${s.opened}, ${s.error ?? "no error"}, messages ${JSON.stringify(s.messageCounts)}`),
  "## Terms pages fetched",
  ...results.terms.map((p) => `- ${p.url}: ${p.status ?? p.error} ${p.bytes ?? ""} bytes`),
].join("\n");
await writeFile("out/summary.md", md);
console.log(md);
