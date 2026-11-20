import { DEFAULT_EXCHANGE, usableExchange, type Exchange } from "@/lib/market/sources";

/** The exchange the address asks for, if readers may pick it. */
export const exchangeInAddress = (): Exchange =>
  usableExchange(new URLSearchParams(window.location.search).get("ex"));

/** The query a chart's address keeps: the exchange, when it isn't the default.
    The coin is the page itself, so `pair` from an old link is dropped. */
export function workspaceSearch(exchange: Exchange = exchangeInAddress()): string {
  const search = new URLSearchParams(window.location.search);
  search.delete("pair");
  if (exchange === DEFAULT_EXCHANGE) search.delete("ex");
  else search.set("ex", exchange);
  const text = search.toString();
  return text ? `?${text}` : "";
}
