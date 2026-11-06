/**
 * Browser probes for spec 007-usability-pass.
 *
 * Playwright owns the server: it serves this repo's existing `.next` with `next start`, so build first
 * (`npm run build`). PROBE_MATCH narrows it by filename regex, and must end in `\.spec\.ts$`.
 *   npx playwright test -c specs/007-usability-pass/review-probes/playwright.probes.config.ts
 */
import os from "node:os";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

const root = path.resolve(__dirname, "../../..");
loadEnv({ path: path.join(root, ".env.local"), override: true, quiet: true });

const PORT = Number(process.env.PROBE_PORT ?? 3407);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: ".",
  // Outside the repo: probe artefacts are not part of the working tree.
  outputDir: path.join(os.tmpdir(), "spec007-probe-results"),
  testMatch: process.env.PROBE_MATCH ? new RegExp(process.env.PROBE_MATCH) : /INV-.*\.spec\.ts$/,
  fullyParallel: true,
  retries: 0,
  reporter: "line",
  timeout: 180_000,
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
