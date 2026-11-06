/**
 * The project's whole e2e suite over this repo's existing `.next`, with no rebuild, so a review can run it in slices that
 * finish inside one command. Same projects as `playwright.config.ts`. SUITE_MATCH narrows it by filename regex.
 *   npm run build
 *   SUITE_MATCH='^[a-c]' npx playwright test -c specs/007-usability-pass/review-probes/playwright.suite.config.ts --workers=4
 */
import os from "node:os";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

const root = path.resolve(__dirname, "../../..");
loadEnv({ path: path.join(root, ".env.local"), override: true, quiet: true });

const PORT = Number(process.env.PROBE_PORT ?? 3408);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: path.join(root, "e2e"),
  outputDir: path.join(os.tmpdir(), "spec007-suite-results"),
  testMatch: process.env.SUITE_MATCH ? new RegExp(process.env.SUITE_MATCH) : /\.spec\.ts$/,
  fullyParallel: true,
  retries: 0,
  reporter: "line",
  use: { baseURL, trace: "off" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "no-pointer",
      testMatch: /usability-density\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--blink-settings=primaryPointerType=1,availablePointerTypes=1,primaryHoverType=1,availableHoverTypes=1"],
        },
      },
    },
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
