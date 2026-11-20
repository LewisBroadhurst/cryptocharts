import { ENGINE_PY } from "@/lib/backtest/engine";
import { PYODIDE_PATH } from "@/lib/backtest/pyodide";

export const dynamic = "force-dynamic";

/**
 * The page the reader's Python runs in. The chart loads it in an
 * `<iframe sandbox="allow-scripts">`, so it has an origin of its own: no
 * cookies, no storage, nothing of the chart page's. Its policy lets it load
 * Pyodide from this site and reach nothing else, so a script can't send data
 * anywhere. The script itself runs in a worker, so a loop that never ends
 * freezes nothing: the chart removes the frame, and the worker goes with it.
 */
export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const pyodide = `${origin}${PYODIDE_PATH}`;
  // Safe inside a <script>: no "<" survives to close the tag early.
  const json = (value: unknown) => JSON.stringify(value).replaceAll("<", "\\u003c");

  // A classic worker that imports Pyodide's module: Chrome won't start a module
  // worker from a blob in a sandboxed frame. Pyodide refuses classic workers by
  // trying importScripts("data:..."); the policy below blocks data: scripts, so
  // that check fails and Pyodide starts.
  const worker = `
const ready = import(${json(`${pyodide}pyodide.mjs`)})
  .then(({ loadPyodide }) => loadPyodide({ indexURL: ${json(pyodide)} }))
  .then((py) => {
    py.runPython(${json(ENGINE_PY)});
    return py;
  });
ready.then(
  () => postMessage({ type: "ready" }),
  (error) => postMessage({ type: "failed", error: String(error?.stack || error) }),
);
onmessage = async (event) => {
  const message = event.data;
  if (!message || message.type !== "run") return;
  const py = await ready;
  const out = py.globals.get("run_backtest")(message.code, JSON.stringify(message.bars), message.fee, message.slippage);
  postMessage({ type: "result", id: message.id, result: JSON.parse(out) });
};`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Backtest sandbox</title></head><body>
<script nonce="${nonce}">
const PAGE = ${json(origin)};
const tell = (message) => parent.postMessage(message, PAGE);
tell({ type: "frame" });
let worker;
try {
  worker = new Worker(
    URL.createObjectURL(new Blob([${json(worker)}], { type: "text/javascript" })),
  );
  worker.onmessage = (event) => tell(event.data);
  worker.onerror = (event) => tell({ type: "failed", error: String(event.message || "The sandbox failed") });
} catch (error) {
  tell({ type: "failed", error: String(error) });
}
addEventListener("message", (event) => {
  if (event.source !== parent || event.origin !== PAGE) return;
  worker?.postMessage(event.data);
});
</script></body></html>`;

  const policy = [
    "default-src 'none'",
    // Pyodide compiles WebAssembly and evaluates some of its own glue code.
    // Neither widens what a script in here can do: it still reaches no network.
    `script-src 'nonce-${nonce}' ${pyodide} blob: 'wasm-unsafe-eval' 'unsafe-eval'`,
    "worker-src blob:",
    `connect-src ${pyodide}`,
    `frame-ancestors ${origin}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": policy,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
