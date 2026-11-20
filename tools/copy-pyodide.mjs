// Copies the Pyodide runtime into public/, under its version, so the site serves
// it from its own address: the backtest sandbox may fetch from nowhere else.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const from = path.join(import.meta.dirname, "../node_modules/pyodide");
const { version } = JSON.parse(readFileSync(path.join(from, "package.json"), "utf8"));
const to = path.join(import.meta.dirname, "../public/pyodide", version);
mkdirSync(to, { recursive: true });
for (const file of [
  "pyodide.js",
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
]) {
  copyFileSync(path.join(from, file), path.join(to, file));
}
console.log(`Pyodide ${version} copied to public/pyodide/${version}`);
