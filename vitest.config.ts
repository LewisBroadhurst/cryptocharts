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
        resolve: { alias },
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
