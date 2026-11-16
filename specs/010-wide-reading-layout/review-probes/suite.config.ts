/**
 * Review round 3: the project's whole e2e suite over the `.next` already built, with no rebuild, so a review can run it in
 * shards that each finish inside one command. Same projects, PHONE_ONLY list and firefox/no-pointer matches as
 * `playwright.config.ts`, because it spreads that config; only the server, port, retries and reporter differ.
 *
 *   npm run build
 *   npx playwright test -c specs/010-wide-reading-layout/review-probes/suite.config.ts --workers=8 --shard=1/8
 *
 * SUITE_MATCH narrows it by filename regex (end it in `\.spec\.ts$`).
 */
import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";
import base from "../../../playwright.config";

const root = path.resolve(__dirname, "../../..");
const PORT = Number(process.env.PROBE_PORT ?? 3121);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  ...base,
  testDir: path.join(root, "e2e"),
  outputDir: path.join(os.tmpdir(), "spec010-suite-results"),
  ...(process.env.SUITE_MATCH ? { testMatch: new RegExp(process.env.SUITE_MATCH) } : {}),
  forbidOnly: false,
  retries: 0,
  reporter: "line",
  use: { ...base.use, baseURL, trace: "off" },
  webServer: {
    command: `npx next start --port ${PORT}`,
    cwd: root,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      BETTER_AUTH_URL: baseURL,
      STABLATURE_TRUSTED_ORIGINS: baseURL,
      STABLATURE_AUTH_RATE_LIMIT: "off",
    },
  },
});
