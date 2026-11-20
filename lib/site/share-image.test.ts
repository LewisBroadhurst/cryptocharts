import { describe, expect, it } from "vitest";

import { pairFor } from "@/lib/market/pairs";
import { SHARE_IMAGE_CACHE, shareImage } from "@/lib/site/share-image";

const PNG = [0x89, 0x50, 0x4e, 0x47];

describe("shareImage", () => {
  it("draws a 1200×630 PNG for a pair without the network", async () => {
    const response = shareImage(pairFor("ETH-USD"));
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe(SHARE_IMAGE_CACHE);

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual(PNG);
    const view = new DataView(bytes.buffer);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630]);
  }, 30_000);
});
