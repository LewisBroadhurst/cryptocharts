# Phase 0: what the exchanges allow

Measured 2026-11-20 by `tools/phase0-probe.mjs` on a GitHub-hosted runner (workflow "Phase 0 probe"). Terms read the
same day.

## Verdict

**Technically, both exchanges work from a browser. Legally, neither lets us show their data on a public site without
written permission.** Phase 1 can't start on either exchange's public API as planned. See "Ways forward" below.

## Terms

**Coinbase**: [Market Data Terms of Use](https://www.coinbase.com/legal/market_data), last updated 2026-08-07. Use is
for "personal or research purposes" and "may not be used to build an application intended for use by end users".
Without Coinbase's prior written consent you may not "redistribute, display, or disseminate" the data, or charts and
analytics derived from it, to anyone outside your organisation. That is exactly what this site does. The Coinbase
Exchange docs say accessing the market data API binds you to these terms.

**Kraken**: no separate market data licence found (`/legal/api-terms` and `/legal/market-data-terms` are 404s). Its
[global terms](https://www.kraken.com/legal/global-terms) (last updated 2026-11-18) let you use "Our Content" "only for
your own benefit"; any other purpose needs Kraken's prior permission. Market data is most likely "Our Content". Treat it
as needing permission.

## Browser access (CORS)

Requests sent with `Origin: https://cryptocharts.stratdeck.uk`:

| Endpoint | Readable from our page? |
|---|---|
| Coinbase Exchange `GET /products/{id}/candles` | Yes: `Access-Control-Allow-Origin: *` |
| Coinbase Advanced Trade public `GET /market/products/{id}/candles` | No: no CORS header, needs a proxy |
| Kraken `GET /0/public/OHLC` | Yes: echoes our origin |

## History depth (BTC/USD)

| Exchange | Interval | Depth |
|---|---|---|
| Coinbase Exchange | 1m | Back to 2015-01 (300 bars per request, page backwards) |
| Coinbase Exchange | 1h, 1d | Back to 2015-07 |
| Kraken | 1m | Last 720 bars only (12 hours), whatever `since` asks for |
| Kraken | 1h | Last 720 bars (30 days) |
| Kraken | 1d | Last 720 bars (about 2 years) |

Kraken's REST history is too shallow for backtests; Kraken offers bulk CSV downloads instead.

## Live streams (no account, 20 s each)

| Feed | What arrived |
|---|---|
| Coinbase Exchange `wss://ws-feed.exchange.coinbase.com` | `ticker` and `match` (every trade): ~11 messages a second. No candles: build bars from trades. |
| Coinbase Advanced Trade `wss://advanced-trade-ws.coinbase.com` | `candles` (5-minute bars, updated in place) and `market_trades`. Works without auth. |
| Kraken v2 `wss://ws.kraken.com/v2` | `ohlc` at the subscribed interval (1m tested) and `trade`. |

## Other findings

- Some networks block exchanges outright. The developer's own connection resets every request to coinbase.com and
  kraken.com while other sites work. Readers on filtered workplace, school or home connections would see empty charts if
  the browser talks straight to the exchanges; data served from our own domain avoids that.
- Binance stays out: US visitors are blocked, and its bulk history (Binance Vision) is licensed non-commercial.

## Ways forward

1. **Ask for written permission.** Email Coinbase and Kraken: a free, public charting site, no trading, credit shown on
   every chart. Coinbase's history depth and feeds are the better fit if both say yes.
2. **A licensed data provider.** Aggregators sell commercial display rights (for example CoinGecko's paid plans, which
   include a commercial licence; CoinDesk Data, Kaiko, CoinAPI). Cost and candle granularity to be priced.
3. **Other exchanges.** Check whether any exchange's terms permit public display outright.
4. **On-chain data.** Prices from public blockchain swaps (DEX pools) carry no exchange licence, but take more work and
   cover fewer pairs.
