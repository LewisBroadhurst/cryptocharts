# Crypto Charts: plan for the new repo

A free, public charting site for crypto at **cryptocharts.stratdeck.uk**, built in its own public GitHub repo
(`cryptocharts`). Live charts, drawing tools, indicators, replay and Python backtests that run in the reader's own
browser. Links lead to StratDeck for stock research. Crypto only: no stock data, now or planned.

The plan for this repo, phase by phase.

## Decisions already made

| Decision | Choice | Why |
|---|---|---|
| Domain | `cryptocharts.stratdeck.uk` | A subdomain of a domain we own: a DNS record, no purchase. The name says crypto only. |
| Repo | Separate, public | A portfolio piece (StratDeck is private), and it keeps StratDeck's secrets out of reach by construction. |
| Data | Crypto exchange public APIs only | No stock data means no exchange licence fees ($250–2,500/mo for US delayed). |
| Price feeds | Browser talks straight to the exchanges | Real-time, no server, no database, no API keys. |
| Login | Later, as "Sign in with StratDeck" | The charts site holds a public key only, never StratDeck's `AUTH_SECRET`. |
| Scripts | Python, run in the reader's browser | No server cost, nothing of ours exposed. Not Pine Script. |
| Tooling | pnpm, Next.js, Vitest, Playwright, GitHub Actions | One app needs no Nx. Public repos get free hosted CI, so nothing runs on the Mac. |
| Licence | None (all rights reserved) unless decided otherwise | Readable as a portfolio, not free to copy. |

## Rules that hold in every phase

**Security**

- No secret ever lives in the repo. Secrets live only in the Vercel project's settings. Phase 1 has none at all.
- Never put a secret in a `NEXT_PUBLIC_` variable: those ship to every browser.
- GitHub secret scanning and push protection on from the first commit; gitleaks in a pre-commit hook and in CI.
- `.env*` in `.gitignore` from the first commit; only a `.env.example` with names and no values.
- A strict Content Security Policy: scripts from our origin only; `connect-src` limited to the exchanges we use.
- Code a reader uploads never runs in the main page (see Phase 3).

**Regulation (UK crypto promotion rules)**

- The site shows prices, charts and private backtests. Nothing on it invites or nudges anyone to buy or trade.
- No "buy on Coinbase" buttons, no exchange referral or affiliate links, no marketing of backtest returns ("this
  strategy made 300%").
- Credit each exchange as its terms ask ("Data from Coinbase").
- Get a short legal check before adding anything that points readers at an exchange.

**Look**

- It carries the StratDeck brand, so it follows StratDeck's `docs/design-system.md` (stratdeck-sleek). Copy the tokens,
  don't invent a second look.

## Phase 0: check before building (about a day)

Each of these can change the design, so settle them first.

1. **Exchange terms.** Read Coinbase's Market Data Terms (coinbase.com/legal/market_data) and Kraken's API terms.
   Confirm public display on a third-party site is allowed and what credit they want. If one says no, drop it.
2. **Browser access (CORS).** WebSockets work from any page, but REST endpoints for history only work from the browser
   if the exchange allows it. Try Coinbase and Kraken candle requests from a page. If one blocks it, history goes through
   a tiny cached Vercel function (no keys, no database), and live prices still come straight from the exchange.
3. **History depth.** From memory, not yet checked: Kraken returns only about the last 720 bars per interval; Coinbase
   returns 300 per request but can page back years. Measure both for 1m, 1h and 1d, since backtests need depth.
4. **Live candles.** Check which intervals each exchange's WebSocket streams. Where only trades are streamed, build the
   current bar from trades in the browser.
5. **Binance.** Blocked for US visitors, and its bulk history (Binance Vision) is licensed non-commercial only. Leave
   it out of version 1.

**Done when:** a short note in the repo records what each exchange allows, its history depth and which data comes from
where.

## Phase 1: live crypto charts (version 1)

- New public repo `cryptocharts`, Next.js on Vercel, a Vercel project of its own, with `cryptocharts.stratdeck.uk` added
  as its domain and a CNAME added in stratdeck.uk's DNS.
- Copy StratDeck's chart components as the starting point: `apps/web/components/charts/*`,
  `apps/web/lib/charts/*` (drawings, indicators: EMA, SMA, Bollinger, RSI, MACD; undo; layouts). Strip anything that
  imports StratDeck internals (stock page data, database, site shell). Grep the copy for keys and URLs before the first
  commit.
- Data layer: one interface (`getHistory(symbol, interval, from, to)`, `subscribe(symbol, interval, onBar)`) with an
  adapter per exchange, so a third exchange is one file.
- Intraday intervals: 1m, 5m, 15m, 1h, 4h, 1D, 1W.
- A symbol picker for the main pairs (BTC, ETH, SOL and the next twenty or so by volume, against USD).
- Layouts, drawings and watchlist saved in the browser (local storage). No login, no database.
- A quiet "Researching stocks? Try StratDeck" link in the header and footer. No pop-ups.
- A README written as the showcase: live link, a GIF, a short diagram of how it fits together, and the security choices.

**Done when:** the site is live at cryptocharts.stratdeck.uk, a chart streams live candles from both exchanges, and the
repo holds no secret, checked by gitleaks in CI.

## Phase 2: replay

- Pick a start date; the chart hides every later bar.
- Step one bar, play, pause, and choose a speed; jump back to live.
- Indicators and drawings work during replay and only ever see bars up to the replay point.
- Built on Lightweight Charts by feeding bars in order (`update`) rather than the whole series at once.

**Done when:** a reader can replay any pair on any interval from any date the history reaches.

## Phase 3: Python backtests

**Where the code runs:** in the reader's browser, through Pyodide in a web worker, inside an `<iframe sandbox>` without
`allow-same-origin`. The frame has no access to the page, its storage or any sign-in, and its CSP lets it fetch only our
own Pyodide files. Bars are passed in by the page; the script never needs the network. Nothing runs on our servers.

**The script format:** one function called once per bar, so a script can never see future prices:

```python
def on_bar(bar, ctx):
    # bar: time, open, high, low, close, volume
    # ctx: history so far, indicators, position, buy(), sell(), close()
    if ctx.sma(20) > ctx.sma(50) and not ctx.position:
        ctx.buy()
    elif ctx.sma(20) < ctx.sma(50) and ctx.position:
        ctx.close()
```

- Readers upload a `.py` file or paste into an editor.
- Results: trade markers on the chart, an equity curve, and a short table (trades, win rate, worst drawdown), with fees
  and slippage settings so results aren't flattering.
- Runs alongside replay: watch the strategy trade bar by bar.
- Pyodide and numpy load only when the backtester opens (a large download, several seconds). Pandas only if a script
  asks for it.
- Scripts stay private, kept in the browser. No public sharing in this phase: that brings moderation and abuse work.
- Wording on results says it's a simulation on past data, never a promise.

**Done when:** an uploaded script runs over a year of 1h bars, draws its trades and equity curve, and a deliberately
hostile script (reads cookies, calls fetch, loops forever) can do nothing but be stopped.

## Phase 4: Sign in with StratDeck

Only once there is something worth syncing across devices.

Built more simply than first planned: no tokens or keys at all. The two sites share a registrable domain
(stratdeck.uk), so the reader's browser can call StratDeck directly with StratDeck's own session cookie, which this
site never sees.

- StratDeck side: `GET`/`PUT /api/charts-site/workspace` keeps the reader's workspace (this site's `cryptocharts.*`
  browser settings: layouts, drawings, backtest script and costs) in a `chart_workspace` table. CORS answers only
  `https://cryptocharts.stratdeck.uk`; a save from any other origin is refused before the session is read. A
  `/cryptocharts` route on StratDeck sends a reader back here after its sign-in, with only the pair and exchange.
- Charts side: "Sign in with StratDeck" goes to StratDeck's sign-in and back. Signed in, an empty account takes this
  browser's work; an account with saved work replaces this browser's, once; after that changes save every few
  seconds. If StratDeck can't be reached, nothing shows and the charts work as before.
- Never shared: StratDeck's `AUTH_SECRET`, its database URL, or any cookie. This project's settings hold no secret.

**Done when:** a reader signs in with their StratDeck account and sees their layouts on a second device, and the charts
project's settings hold no StratDeck secret.

## Testing

Same tiers as StratDeck, cheapest that can fail:

- Vitest node: indicators, bar building from trades, replay stepping, exchange adapters against recorded responses,
  backtest maths.
- Vitest browser: the chart workspace, drawing tools, replay controls.
- Playwright: the few journeys across pages, and that the sandboxed frame can't reach the page.

All on GitHub Actions' free hosted runners.

## Still to decide

- The product name: "StratDeck Crypto Charts", "ChartDeck" or something else. The subdomain doesn't have to match.
- Whether to add a licence later (MIT if you want others to reuse it).
- Whether issues and pull requests from strangers are open, or turned off with a note in the README.

## Optional: deeper history from Kraken's downloadable files

Kraken's API serves only the newest 720 bars per interval: 12 hours of 1-minute bars, 30 days of hourly, about two years
of daily. That limits replay and makes backtests short.

**Scoped 20 November 2026. Waiting on Kraken: see "Before building".**

### Where the data comes from

- **The archive.** Kraken publishes OHLCVT CSVs for every pair from the start of each market, on its own servers
  (assets.kraken.com), as one full archive split into five parts, plus an incremental zip at the end of each quarter.
  Each holds 1, 5, 15, 30, 60, 240, 720 and 1440-minute bars, no header row, and only intervals with trades (a missing
  bar means no trades). Third-party write-ups put single files above 7 GB, so the full download is large; exact size
  unknown until downloaded.
- **The gap after the last quarter.** The archive ends at a quarter's end. The public `Trades` endpoint can fill from
  there: `since` pages through every trade, 1,000 a call, with a delay of a second or two between calls. For 14 pairs
  that is a one-off of hours, not days.
- **Keeping it current.** The OHLC API's 720 one-minute bars cover 12 hours, so a job every 6 hours that stores them
  never leaves a gap. Every larger interval can be built from 1-minute bars.

### Size, for our 14 pairs

Packed as compact binary (time plus five numbers, about 24 bytes a bar), before compression:

- 1-minute: about 160 MB for Bitcoin since 2013, around 1 GB for all 14 pairs.
- 5-minute: about a fifth of that, roughly 200 MB. 15-minute and up: tens of MB together.
- So start with 5-minute and up (about 250 MB in all), and keep 1-minute to the last year or two.

### Where to keep it

- **Cloudflare R2**, recommended: stratdeck.uk's DNS is already on Cloudflare. 10 GB storage and egress free; a public
  bucket on a subdomain such as `data.stratdeck.uk`, added to the page's `connect-src`. The job needs an R2 write
  token as a GitHub Actions secret (stored in GitHub's settings, never in the repo).
- Vercel Blob also works, but egress is billed and its host would also need adding to the policy.
- GitHub release assets are free but can't be fetched from a browser (no CORS), so they'd need proxying.

### How it would work

- A one-off GitHub Actions job: download the archive, keep our 14 pairs, write one file per pair, interval and month,
  fill to now from `Trades`, upload to R2.
- A job every 6 hours: store the newest 1-minute bars from the API and rebuild the current month's files.
- The Kraken adapter reads older bars from the files and newer ones from the API, joining where they meet, and turns
  on `pagesBack`, so scrolling back, replay and backtests get years of bars.

### Before building

- **Kraken's answer.** The permission email told Kraken readers "can't download the raw data". Public history files
  can be downloaded by anyone who finds their address, which is different from what was asked. Ask Kraken about this
  specifically in the reply to their auto-response, and build only once they agree.
- **Kraken's licence for the archive itself.** The support page for the files (support.kraken.com) couldn't be read
  from here; check it for terms of use before downloading.
- **A Cloudflare R2 bucket and token**, which only Lewis can create.

**Done when:** BTC/USD on 1h replays and backtests over several years, scrolling back loads older bars, and the files
refresh every 6 hours without anyone touching them.
