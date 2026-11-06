/**
 * The usability audit for spec 007. Not part of the suite: it measures and writes, it does not assert.
 *
 * Playwright owns the server and serves this repo's existing `.next`, so build first:
 *   npm run build && npx playwright test -c specs/007-usability-pass/audit/playwright.audit.config.ts
 * Results land in `results/`, one JSON per screen, size and theme. `summarise.mjs` prints the tables
 * the spec quotes, so the same run gives the before and after figures docs/DECISIONS.md needs.
 */
import os from "node:os";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

const root = path.resolve(__dirname, "../../..");
loadEnv({ path: path.join(root, ".env.local"), override: true, quiet: true });

const PORT = Number(process.env.AUDIT_PORT ?? 3307);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: ".",
  outputDir: path.join(os.tmpdir(), "spec007-audit-results"),
  testMatch: process.env.AUDIT_MATCH ? new RegExp(process.env.AUDIT_MATCH) : /.*\.audit\.ts$/,
  fullyParallel: true,
  workers: 6,
  retries: 0,
  reporter: "line",
  timeout: 180_000,
  use: { baseURL, trace: "off" },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
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
