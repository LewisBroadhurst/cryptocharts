import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PYODIDE_VERSION } from "@/lib/backtest/pyodide";

describe("PYODIDE_VERSION", () => {
  it("matches the installed pyodide, so the sandbox loads files that exist", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(import.meta.dirname, "../../node_modules/pyodide/package.json"), "utf8"),
    );
    expect(PYODIDE_VERSION).toBe(pkg.version);
  });
});
