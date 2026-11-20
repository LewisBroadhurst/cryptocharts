import { describe, expect, it } from "vitest";

import {
  applySaved,
  onSignIn,
  readAccount,
  signInHref,
  snapshot,
  type KeyValueStore,
} from "@/lib/account/workspace-sync";

function store(initial: Record<string, string>): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe("snapshot", () => {
  it("takes this site's settings and nothing else in the browser", () => {
    const s = store({ "cryptocharts.layout.v1": "{}", "other.thing": "x" });
    expect(snapshot(s)).toEqual({ "cryptocharts.layout.v1": "{}" });
  });
});

describe("applySaved", () => {
  it("makes the browser's settings exactly the saved ones, leaving others alone", () => {
    const s = store({ "cryptocharts.old": "1", "cryptocharts.layout.v1": "a", "other.thing": "x" });
    applySaved(s, { "cryptocharts.layout.v1": "b", "cryptocharts.drawings.v1:BTC-USD": "[]" });
    expect(Object.fromEntries(s.data)).toEqual({
      "cryptocharts.layout.v1": "b",
      "cryptocharts.drawings.v1:BTC-USD": "[]",
      "other.thing": "x",
    });
  });
});

describe("onSignIn", () => {
  it("uploads this browser's work to an empty account", () => {
    expect(onSignIn({ "cryptocharts.a": "1" }, null)).toBe("upload");
    expect(onSignIn({ "cryptocharts.a": "1" }, {})).toBe("upload");
    expect(onSignIn({}, null)).toBe("nothing");
  });

  it("brings an account's saved work to this browser, unless it already has it", () => {
    expect(onSignIn({ "cryptocharts.a": "1" }, { "cryptocharts.a": "2" })).toBe("download");
    expect(onSignIn({ "cryptocharts.a": "1" }, { "cryptocharts.a": "1" })).toBe("nothing");
  });
});

describe("readAccount", () => {
  it("drops anything that isn't this site's setting", () => {
    expect(
      readAccount({ signedIn: true, name: "Lewis", data: { "cryptocharts.a": "1", evil: "x", "cryptocharts.b": 2 } }),
    ).toEqual({ signedIn: true, name: "Lewis", data: { "cryptocharts.a": "1" }, updatedAt: null });
    expect(readAccount({ signedIn: false })).toEqual({ signedIn: false });
    expect(readAccount("nope")).toBeNull();
  });
});

describe("signInHref", () => {
  it("signs in at StratDeck and comes back to the same chart", () => {
    expect(signInHref("?pair=ETH-USD&ex=kraken&junk=1")).toBe(
      "https://www.stratdeck.uk/sign-in?callbackUrl=%2Fcryptocharts%3Fpair%3DETH-USD%26ex%3Dkraken",
    );
    expect(signInHref("")).toBe("https://www.stratdeck.uk/sign-in?callbackUrl=%2Fcryptocharts");
  });
});
