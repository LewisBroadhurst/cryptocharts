# Indicator and backtest pages

Pages built to win narrow searches ("bitcoin rsi", "eth 200 day moving
average", "bitcoin golden cross") that the big sites answer with a generic
chart. Each page opens the live chart already set up for that search and
leads with the current reading, so it answers the question before anyone
scrolls.

## What we chart today

- 14 coins (`lib/market/pairs.ts`): BTC, ETH, SOL, XRP, DOGE, ADA, AVAX, LINK,
  DOT, LTC, BCH, XLM, UNI, AAVE.
- Indicators (`lib/charts/studies.ts`): EMA, SMA, Bollinger Bands, RSI, MACD.
  The maths in `lib/charts/indicators.ts` is plain TypeScript, so the server
  can use it too.
- Backtest: Python `on_bar(bar, ctx)` strategies run in the browser
  (`lib/backtest/engine.ts`), with `ctx.sma/ema/rsi/highest/lowest`.

## URLs

Coin pages stay where they are (`/` for Bitcoin, `/ethereum`, ...). New pages
sit under the coin's slug, Bitcoin included:

```
/bitcoin/rsi
/bitcoin/200-day-moving-average
/ethereum/backtest/golden-cross
/indicators/rsi                      hub: every coin's reading
/backtests                           hub: every strategy, every coin
```

`/bitcoin` itself redirects to `/`.

## Indicator pages: `/{coin}/{indicator}`

| Slug | Title (Bitcoin example) | Chart opens with | Lead reading |
|---|---|---|---|
| `rsi` | Bitcoin RSI chart | Daily, RSI 14 | "RSI 14 (daily): 64.2". Overbought above 70, oversold below 30; last time each happened |
| `200-day-moving-average` | Bitcoin 200-day moving average | Daily, SMA 200 | Price vs the 200-day SMA, as %; days since it last crossed |
| `200-week-moving-average` | Bitcoin 200-week moving average | Weekly, SMA 200 | Price vs the 200-week SMA, as %. Only for coins with 200+ weeks of data |
| `50-day-moving-average` | Bitcoin 50-day moving average | Daily, SMA 50 | Price vs the 50-day SMA |
| `golden-cross` | Bitcoin golden cross and death cross | Daily, SMA 50 + SMA 200 | Which is on now, its date, and the dates of the last few crosses |
| `macd` | Bitcoin MACD chart | Daily, MACD 12 26 9 | MACD line, signal line, histogram; last crossover |
| `bollinger-bands` | Bitcoin Bollinger Bands | Daily, BB 20 2 | Where price sits in the bands; band width vs its 6-month average |

7 × 14 coins = 98 pages.

### On each page

1. H1 + a single line with the reading, from daily data refreshed every 15
   minutes like the coin pages.
2. The live chart, opened with the page's indicator and timeframe. **It must
   not overwrite the reader's saved layout**: the page preset applies only
   until they change something, and it's never written to storage.
3. 2–4 sentences generated from the numbers ("Bitcoin has been above its
   200-day moving average for 41 days, its longest run since March"). That
   text is the page's content and what makes it different from the other 13
   coins' versions. No definitions, no filler.
4. A small table: the reading on 1h / 4h / 1D / 1W.
5. Links: the same indicator for other coins, other indicators for this coin,
   and the backtest that trades on it.

## Backtest pages: `/{coin}/backtest/{strategy}`

| Slug | Title | Rules |
|---|---|---|
| `golden-cross` | Bitcoin golden cross backtest | Long when SMA 50 crosses above SMA 200, flat on the death cross |
| `ema-crossover` | Bitcoin EMA 9/21 crossover backtest | Long when EMA 9 > EMA 21, flat when below (the current example strategy) |
| `rsi` | Bitcoin RSI backtest | Buy when RSI 14 < 30, sell when > 70 |
| `200-day-moving-average` | Bitcoin 200-day moving average strategy | Long above the 200-day SMA, flat below |

4 × 14 = 56 pages.

### On each page

1. Results against buy and hold, over the full daily history: total return,
   max drawdown, win rate, number of trades, current position and last signal.
   Fees and slippage stated.
2. Equity curve vs buy and hold.
3. The strategy's Python, and **Open in backtester**, which loads that code
   with the same settings so the reader gets the same numbers and can edit it.
4. Trade list (last 10).
5. Links to the same strategy on other coins and the matching indicator page.

## Hub pages

- `/indicators/rsi`: every coin's RSI now, sorted, with overbought/oversold
  marked. Aims at "crypto rsi", "overbought crypto".
- `/indicators/200-day-moving-average`: which coins are above or below.
- `/indicators/golden-cross`: which coins are in a golden cross or a death
  cross, with dates.
- `/backtests`: each strategy's return and max drawdown on every coin.

These are worth more than any single coin page: they change daily and other
sites have a reason to link to them.

## What has to be built

1. **Daily and weekly candles on the server.** Kraken's OHLC endpoint returns
   720 bars: about 2 years daily (enough for SMA 200) and 13+ years weekly.
   Cache alongside the existing snapshot fetch.
2. **Opening the chart with a preset** (indicators, timeframe, strategy)
   without touching the reader's saved workspace. Today only `?ex=` is read
   from the address.
3. **The four strategies in TypeScript** so the server can compute results.
   A test runs each one through both the TypeScript version and the Python
   engine on the same bars and checks they agree, so "Open in backtester"
   always shows the same numbers.
4. Metadata, structured data, share images (extend `lib/site/share-image.tsx`
   with the reading) and sitemap entries for each page.

## Rollout

1. **First batch, 14 pages:** Bitcoin, Ethereum and Solana × RSI, 200-day
   moving average, golden cross and the golden-cross backtest, plus the RSI
   and golden-cross hubs.
2. Submit the sitemap in Search Console and give it 6–8 weeks. Watch
   impressions per page, not clicks; impressions show up first.
3. Roll out to the rest of the coins and pages that showed impressions. Add a
   coin's version of a page only if its data supports it (no 200-week page for
   a coin with 2 years of history).

Keep low-volume combinations (Stellar MACD, say) out of the sitemap and
`noindex`ed until the rest are getting impressions. 150 near-identical pages
from a new domain can count against the whole site.
