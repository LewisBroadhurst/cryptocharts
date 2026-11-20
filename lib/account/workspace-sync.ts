/**
 * Saving a reader's workspace (layouts, drawings, backtest scripts) to their
 * StratDeck account. The browser calls StratDeck directly with StratDeck's own
 * session cookie, which this site never sees: it holds no key, token or secret.
 */
export const STRATDECK = "https://www.stratdeck.uk";
const WORKSPACE_API = `${STRATDECK}/api/charts-site/workspace`;
/** Every setting this site keeps in the browser is under this prefix. */
export const PREFIX = "cryptocharts.";

export type Account =
  | { signedIn: false }
  | { signedIn: true; name: string | null; data: Record<string, string> | null; updatedAt: string | null };

/** A Storage, or a stand-in for one in tests. */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

/** Every setting this site keeps, as stored. */
export function snapshot(store: KeyValueStore): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    const value = store.getItem(key);
    if (value !== null) out[key] = value;
  }
  return out;
}

/** Makes this browser's settings exactly the saved ones. */
export function applySaved(store: KeyValueStore, saved: Record<string, string>): void {
  for (const key of Object.keys(snapshot(store)))
    if (!(key in saved)) store.removeItem(key);
  for (const [key, value] of Object.entries(saved))
    if (key.startsWith(PREFIX)) store.setItem(key, value);
}

export const sameWorkspace = (a: Record<string, string>, b: Record<string, string>) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

/** What to do on finding the reader signed in. */
export function onSignIn(
  local: Record<string, string>,
  saved: Record<string, string> | null,
): "upload" | "download" | "nothing" {
  if (!saved || Object.keys(saved).length === 0)
    return Object.keys(local).length > 0 ? "upload" : "nothing";
  return sameWorkspace(local, saved) ? "nothing" : "download";
}

export function readAccount(value: unknown): Account | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (raw.signedIn === false) return { signedIn: false };
  if (raw.signedIn !== true) return null;
  const data =
    typeof raw.data === "object" && raw.data !== null && !Array.isArray(raw.data)
      ? Object.fromEntries(
          Object.entries(raw.data).filter(
            (entry): entry is [string, string] =>
              entry[0].startsWith(PREFIX) && typeof entry[1] === "string",
          ),
        )
      : null;
  return {
    signedIn: true,
    name: typeof raw.name === "string" ? raw.name : null,
    data,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

/** The reader's account, or null when StratDeck can't be reached. */
export async function fetchAccount(): Promise<Account | null> {
  try {
    const res = await fetch(WORKSPACE_API, { credentials: "include", cache: "no-store" });
    return readAccount(await res.json());
  } catch {
    return null;
  }
}

export async function saveWorkspace(data: Record<string, string>): Promise<boolean> {
  try {
    const res = await fetch(WORKSPACE_API, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** StratDeck's sign-in, coming back to this chart afterwards. */
export function signInHref(search: string): string {
  const here = new URLSearchParams(search);
  const back = new URLSearchParams();
  for (const name of ["pair", "ex"]) {
    const value = here.get(name);
    if (value) back.set(name, value);
  }
  const query = back.toString();
  const callback = `/cryptocharts${query ? `?${query}` : ""}`;
  return `${STRATDECK}/sign-in?callbackUrl=${encodeURIComponent(callback)}`;
}
