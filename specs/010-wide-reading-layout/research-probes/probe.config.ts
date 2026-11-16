import { defineConfig, devices } from "@playwright/test";

/**
 * Spec 010 research: records the fit figures on the unedited tree. Not part of the suite (the suite's
 * testDir is e2e/). Build first, then: `npx playwright test -c specs/010-wide-reading-layout/research-probes/probe.config.ts`.
 */
const PORT = 3110;
export default defineConfig({
  testDir: ".",
  testMatch: /\.probe\.ts$/,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start --port ${PORT}`,
    cwd: "../../..",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      STABLATURE_TRUSTED_ORIGINS: `http://localhost:${PORT}`,
      STABLATURE_AUTH_RATE_LIMIT: "off",
    },
  },
});
