export type StorageArea = "local" | "session";

export type FirstVisitPrompt = {
  key: string;
  area: StorageArea;
  seen: () => string;
};

const store = (area: StorageArea): Storage =>
  area === "local" ? window.localStorage : window.sessionStorage;

/** The string kept under `key`: null where nothing is, and undefined where
    the store cannot be read at all, as in some privacy modes, which throw on
    any access. */
export function readStored(
  key: string,
  area: StorageArea = "local",
): string | null | undefined {
  try {
    return store(area).getItem(key);
  } catch {
    return undefined;
  }
}

/** Keeps `value` under `key`, or forgets the key for null. False where the
    store refused it: private browsing, or a full quota. */
export function writeStored(
  key: string,
  value: string | null,
  area: StorageArea = "local",
): boolean {
  try {
    if (value === null) store(area).removeItem(key);
    else store(area).setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function readStoredJson(
  key: string,
  area: StorageArea = "local",
): unknown {
  const raw = readStored(key, area);
  if (raw == null) return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export function writeStoredJson(
  key: string,
  value: unknown,
  area: StorageArea = "local",
): boolean {
  return writeStored(key, value === null ? null : JSON.stringify(value), area);
}
