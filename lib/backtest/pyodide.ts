// Where the site serves Pyodide from (tools/copy-pyodide.mjs puts it there).
// Kept in step with the pyodide version in package.json by its test.
export const PYODIDE_VERSION = "314.0.7";
export const PYODIDE_PATH = `/pyodide/${PYODIDE_VERSION}/`;
