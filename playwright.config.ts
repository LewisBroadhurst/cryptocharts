import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Set BASE_URL to test a deployed site (the daily live check does); leave it
// unset to build-and-serve locally on PORT.
const BASE_URL = process.env.BASE_URL;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: BASE_URL || `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: BASE_URL
    ? undefined
    : {
        command: `pnpm start --port ${PORT}`,
        port: PORT,
        reuseExistingServer: false,
      },
});
