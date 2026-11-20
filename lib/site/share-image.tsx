import { ImageResponse } from "next/og";

import type { Pair } from "@/lib/market/pairs";
import { SHARE_IMAGE_SIZE, SITE_NAME } from "@/lib/site/seo";

// StratDeck's tokens as plain hex, since the image is drawn without the CSS.
const BACKGROUND = "#0a0a0a"; // neutral-950
const FOREGROUND = "#f5f5f5"; // neutral-100
const BODY = "#d4d4d4"; // neutral-300
const MUTED = "#737373"; // neutral-500
const RULE = "#262626"; // neutral-800
const BRAND = "#34d399"; // emerald-400

/** A day at the edge, a week served stale while it redraws: the picture only
    changes when the code does. */
export const SHARE_IMAGE_CACHE =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";

/** The card a link to a pair's chart unfurls into: the coin, what the reader
    gets, and the site. No price, so it needs nothing from the network. */
export function shareImage(pair: Pair): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 88px",
          background: BACKGROUND,
          color: FOREGROUND,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 36 }}>
          <div style={{ width: 20, height: 20, borderRadius: 10, background: BRAND }} />
          <div style={{ display: "flex" }}>{SITE_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", fontSize: 128, lineHeight: 1.05, letterSpacing: -3 }}>
            {pair.name}
          </div>
          <div style={{ display: "flex", fontSize: 56, color: BRAND }}>
            {`${pair.base} / USD`}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            paddingTop: 32,
            borderTop: `2px solid ${RULE}`,
          }}
        >
          <div style={{ display: "flex", fontSize: 44, color: BODY }}>Live price chart</div>
          <div style={{ display: "flex", fontSize: 30, color: MUTED }}>
            Drawing tools · Indicators · Replay · Backtests
          </div>
        </div>
      </div>
    ),
    { ...SHARE_IMAGE_SIZE, headers: { "Cache-Control": SHARE_IMAGE_CACHE } },
  );
}
