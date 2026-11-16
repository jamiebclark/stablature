/**
 * Spec 011 review: Playwright over this repo's existing `.next` (no rebuild), so the play-* suite and the review's
 * own e2e probes can run in slices that each finish inside one command. Same devices as `playwright.config.ts`.
 *   npm run build
 *   REVIEW_DIR=probes npx playwright test -c specs/011-tab-playback/review-probes/playwright.review.config.ts
 *   REVIEW_DIR=e2e REVIEW_MATCH='play-.*\.spec\.ts$' npx playwright test -c specs/011-tab-playback/review-probes/playwright.review.config.ts
 */
import os from "node:os";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

const root = path.resolve(__dirname, "../../..");
loadEnv({ path: path.join(root, ".env.local"), override: true, quiet: true });

const PORT = Number(process.env.PROBE_PORT ?? 3411);
const baseURL = `http://localhost:${PORT}`;
const probes = process.env.REVIEW_DIR !== "e2e";

export default defineConfig({
  testDir: probes ? __dirname : path.join(root, "e2e"),
  outputDir: path.join(os.tmpdir(), "spec011-review-results"),
  testMatch: process.env.REVIEW_MATCH ? new RegExp(process.env.REVIEW_MATCH) : /\.spec\.ts$/,
  fullyParallel: true,
  retries: 0,
  reporter: "line",
  timeout: 120_000,
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
