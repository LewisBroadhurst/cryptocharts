import { ImageResponse } from "next/og";

import StratDeckMark from "@/components/site/StratDeckMark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS ignores an SVG favicon and fills a transparent icon with its own
// background, so the home-screen icon is the mark on the site's near-black.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
        }}
      >
        <StratDeckMark size={132} />
      </div>
    ),
    size,
  );
}
