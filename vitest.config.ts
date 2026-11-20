import path from "node:path";

import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const alias = { "@": path.resolve(import.meta.dirname) };
const SOURCE = "{app,components,lib,hooks}";

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          include: [`${SOURCE}/**/*.test.ts`],
        },
      },
      {
        resolve: { alias, dedupe: ["react", "react-dom"] },
        // The shared UI package ships TypeScript source, which Vite doesn't
        // pre-bundle; pre-bundling it here also turns the CommonJS react-dom it
        // imports into the ESM a browser can load.
        optimizeDeps: {
          include: [
            "react-dom",
            "@big-shared/ui/button",
            "@big-shared/ui/card",
            "@big-shared/ui/cn",
            "@big-shared/ui/dialog",
            "@big-shared/ui/hover-tip",
            "@big-shared/ui/input",
            "@big-shared/ui/modal",
            "@big-shared/ui/modal-header",
            "@big-shared/ui/popover",
            "@big-shared/ui/tooltip",
            "@big-shared/ui/use-shut-away",
          ],
        },
        test: {
          name: "browser",
          include: [`${SOURCE}/**/*.component.test.tsx`],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
