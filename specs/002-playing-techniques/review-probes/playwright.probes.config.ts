/**
 * Review probes for spec 002-playing-techniques.
 *
 * Playwright owns the server: it serves this repo's existing `.next` with `next start`, so
 * build first (`npm run build`, or any `npm run test:e2e`). `run-probes.sh` does both.
 * PROBE_MATCH narrows it to any probe by filename regex.
 */
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PROBE_PORT ?? 3302);
const baseURL = `http://localhost:${PORT}`;
const root = path.resolve(__dirname, "../../..");

export default defineConfig({
  testDir: ".",
  // Outside the repo: probe artefacts are not part of the working tree.
  outputDir: path.join(os.tmpdir(), "spec002-probe-results"),
  testMatch: process.env.PROBE_MATCH ? new RegExp(process.env.PROBE_MATCH) : /(INV|FR)-.*\.spec\.ts$/,
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "off" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    cwd: root,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      BETTER_AUTH_URL: baseURL,
      STABLATURE_TRUSTED_ORIGINS: baseURL,
      STABLATURE_AUTH_RATE_LIMIT: "off",
    },
  },
});
