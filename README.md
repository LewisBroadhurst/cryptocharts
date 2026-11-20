# Crypto Charts

Free, live crypto charts with drawing tools, indicators, replay and Python backtests that run in your own browser.

Backtests run your Python in [Pyodide](https://pyodide.org) inside a sandboxed frame with its own origin and a
policy that lets it load Pyodide from this site and reach nothing else (`app/sandbox/route.ts`).

Prices come from Kraken. Coinbase is in the menu, locked, until Coinbase agrees to its prices being shown here.

Coming to [cryptocharts.stratdeck.uk](https://cryptocharts.stratdeck.uk). Researching stocks? Try
[StratDeck](https://www.stratdeck.uk).

See [PLAN.md](PLAN.md) for how it's being built, and [docs/phase-0.md](docs/phase-0.md) for what the exchanges allow.

All rights reserved. The code is public to read; no licence to reuse it is granted.

## Run it

```bash
pnpm install
pnpm dev
```

`pnpm test` (logic), `pnpm test:browser` (the chart in a real browser), `pnpm test:live` and `pnpm exec playwright test`
(against the real exchanges; CI runs these on every push).
