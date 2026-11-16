import { defineConfig, devices } from "@playwright/test";

/**
 * Spec 010 review probes. Not part of the suite (the suite's testDir is e2e/). Serves the build already in .next on
 * its own port, so it never rebuilds and never shares the suite's server.
 *
 *   npm run build
 *   npx playwright test -c specs/010-wide-reading-layout/review-probes/probe.config.ts
 *
 * PROBE_DIR=../../../e2e PROBE_MATCH='wide-.*\.spec\.ts' runs the feature's own wide specs against the same server.
 */
const PORT = Number(process.env.PROBE_PORT ?? 3120);
const firefoxOnly = /firefox\.probe\.ts$/;
export default defineConfig({
  testDir: process.env.PROBE_DIR ?? ".",
  testMatch: process.env.PROBE_MATCH ? new RegExp(process.env.PROBE_MATCH) : /\.probe\.ts$/,
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] }, testIgnore: firefoxOnly },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: firefoxOnly },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, testMatch: firefoxOnly },
  ],
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
