/**
 * Runs a probe against an already-built tree, with Playwright owning the server's lifecycle.
 *
 *   BASELINE_DIR=<a built export of main> BASELINE_OUT=<file stem> npx playwright test \
 *     --config specs/002-playing-techniques/review-probes/playwright.baseline.config.ts
 *   BASELINE_IN=<file stem> npx playwright test --config <this file>      # this repo's .next
 *
 * Export main with `git archive` and give it a real copy of node_modules: Turbopack rejects a
 * junction that points outside the project root.
 */
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PROBE_PORT ?? 3303);
const baseURL = `http://localhost:${PORT}`;
const root = path.resolve(__dirname, "../../..");

export default defineConfig({
  testDir: ".",
  outputDir: path.join(os.tmpdir(), "spec002-baseline-results"),
  testMatch: process.env.PROBE_MATCH ? new RegExp(process.env.PROBE_MATCH) : /INV-019-baseline-any-build\.spec\.ts$/,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "off" },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npx next start --port ${PORT}`,
    cwd: process.env.BASELINE_DIR ?? root,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
