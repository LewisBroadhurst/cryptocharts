import packages from "./python-packages.json";

// Where the site serves Pyodide from (tools/copy-pyodide.mjs puts it there).
// Kept in step with the pyodide version in package.json by its test.
export const PYODIDE_VERSION = "314.0.7";
export const PYODIDE_PATH = `/pyodide/${PYODIDE_VERSION}/`;

/**
 * Python packages the site serves beside Pyodide, which a backtest script may
 * import (tools/copy-pyodide.mjs downloads them at build time). Each is loaded
 * only when a script imports it; its import name is its package name.
 */
export const PYTHON_PACKAGES: readonly string[] = packages;
