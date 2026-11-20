import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import "@/app/globals.css";
import AccountBadge from "@/components/account/AccountBadge";

type Call = { url: string; method: string; body?: string; credentials?: RequestCredentials };

function fakeStratDeck(answer: unknown | Error) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: init.method ?? "GET",
      body: init.body as string | undefined,
      credentials: init.credentials,
    });
    if (answer instanceof Error) throw answer;
    if ((init.method ?? "GET") === "PUT")
      return new Response(
        JSON.stringify({ saved: true, updatedAt: `2026-11-20T12:00:0${calls.length}.000Z` }),
        { status: 200 },
      );
    return new Response(JSON.stringify(answer), { status: 200 });
  });
  return calls;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("AccountBadge", () => {
  it("offers StratDeck's sign-in when signed out", async () => {
    const calls = fakeStratDeck({ signedIn: false });
    const screen = await render(<AccountBadge />);
    const link = screen.getByRole("link", { name: /Sign in with StratDeck/ });
    await expect.element(link).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\/www\.stratdeck\.uk\/sign-in\?callbackUrl=%2Fcryptocharts/),
    );
    expect(calls[0]).toMatchObject({
      url: "https://www.stratdeck.uk/api/charts-site/workspace",
      credentials: "include",
    });
  });

  it("shows nothing when StratDeck can't be reached", async () => {
    fakeStratDeck(new TypeError("Failed to fetch"));
    const screen = await render(<AccountBadge />);
    await new Promise((done) => setTimeout(done, 100));
    expect(screen.container.textContent).toBe("");
  });

  it("saves this browser's charts to an account with none saved, and says so", async () => {
    localStorage.setItem("cryptocharts.layout.v1", '{"interval":"4h"}');
    localStorage.setItem("someone.else", "keep out");
    const calls = fakeStratDeck({ signedIn: true, name: "Lewis", data: null, updatedAt: null });
    const screen = await render(<AccountBadge />);
    await expect
      .element(screen.getByRole("link", { name: "Saved to Lewis's StratDeck account" }))
      .toBeVisible();
    const put = calls.find((call) => call.method === "PUT")!;
    expect(JSON.parse(put.body!)).toEqual({
      data: { "cryptocharts.layout.v1": '{"interval":"4h"}' },
      baseUpdatedAt: null,
    });
  });

  it("saves again when the charts change", async () => {
    vi.useFakeTimers({ toFake: ["setInterval"] });
    const calls = fakeStratDeck({
      signedIn: true,
      name: null,
      data: { "cryptocharts.layout.v1": "a" },
      updatedAt: "2026-11-20T12:00:00Z",
    });
    localStorage.setItem("cryptocharts.layout.v1", "a");
    const screen = await render(<AccountBadge />);
    await expect.element(screen.getByText("Saved to your StratDeck account")).toBeVisible();
    expect(calls.filter((call) => call.method === "PUT")).toHaveLength(0);

    localStorage.setItem("cryptocharts.layout.v1", "b");
    vi.advanceTimersByTime(4_000);
    await expect.poll(() => calls.filter((call) => call.method === "PUT").length).toBe(1);
    const put = calls.find((call) => call.method === "PUT")!;
    expect(JSON.parse(put.body!).baseUpdatedAt).toBe("2026-11-20T12:00:00Z");
    vi.useRealTimers();
  });
});
