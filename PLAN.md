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

- StratDeck side: a small endpoint that, for a signed-in reader, returns a short-lived token signed with a private key
  that never leaves StratDeck. This is a change to the StratDeck repo.
- Charts side: holds only the matching public key (safe in a public repo), checks the token, learns "user 123" and
  nothing else.
- Saved layouts and scripts sync through a small StratDeck endpoint, or a separate small database holding only the
  charts site's own tables, under a role with no access to StratDeck's.
- Never shared: StratDeck's `AUTH_SECRET`, its database URL, or a cookie set across all of `*.stratdeck.uk`.

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
