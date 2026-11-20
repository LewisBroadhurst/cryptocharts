// Copies the Pyodide runtime into public/, under its version, so the site serves
// it from its own address: the backtest sandbox may fetch from nowhere else.
//
// The npm package has no Python packages in it, so the ones scripts may import
// are downloaded here, at build time, from Pyodide's release files for the same
// version, and checked against the lock file's hashes. The sandbox then loads
// them from this site like the rest of Pyodide.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Packages a backtest script may import; their dependencies come too. */
const PACKAGES = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "../lib/backtest/python-packages.json"), "utf8"),
);

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

const lock = JSON.parse(readFileSync(path.join(from, "pyodide-lock.json"), "utf8"));
const wanted = new Map();
const add = (name) => {
  const entry = lock.packages[name];
  if (!entry) throw new Error(`${name} isn't in Pyodide ${version}'s lock file`);
  if (wanted.has(name)) return;
  wanted.set(name, entry);
  entry.depends.forEach(add);
};
PACKAGES.forEach(add);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const base = `https://cdn.jsdelivr.net/pyodide/v${version}/full/`;
let fetched = 0;

for (const { name, file_name: file, sha256: expected } of wanted.values()) {
  // A plain file name, so nothing in the lock file can write outside `to`.
  if (path.basename(file) !== file) throw new Error(`Unexpected file name for ${name}: ${file}`);
  const target = path.join(to, file);
  if (existsSync(target) && sha256(readFileSync(target)) === expected) continue;

  const response = await fetch(base + file).catch((error) => {
    throw new Error(`Couldn't download ${file} for ${name}: ${error.message}`);
  });
  if (!response.ok) throw new Error(`Couldn't download ${file} for ${name}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const got = sha256(bytes);
  if (got !== expected)
    throw new Error(`${file} doesn't match Pyodide's lock file: sha256 ${got}, expected ${expected}`);
  writeFileSync(`${target}.part`, bytes);
  renameSync(`${target}.part`, target);
  fetched += bytes.length;
}
console.log(
  `Python packages ready: ${[...wanted.keys()].join(", ")}` +
    (fetched ? ` (downloaded ${(fetched / 1e6).toFixed(1)} MB)` : " (already present)"),
);
