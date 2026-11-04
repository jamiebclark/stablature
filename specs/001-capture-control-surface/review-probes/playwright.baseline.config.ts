/**
 * Runs INV-012-r2-measure-any-build.spec.ts against an already-built tree, with Playwright
 * owning the server's lifecycle (as the project's own config does).
 *
 *   BASELINE_DIR=<a built checkout of main> PROBE_PORT=3301 npx playwright test \
 *     --config specs/001-capture-control-surface/review-probes/playwright.baseline.config.ts
 *
 * With no BASELINE_DIR it serves this repo's `.next`. PROBE_MATCH narrows it to any probe by
 * filename regex, so a probe can run with Playwright owning the server.
 */
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PROBE_PORT ?? 3301);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: ".",
  outputDir: path.join(os.tmpdir(), "spec001-baseline-results"),
  testMatch: process.env.PROBE_MATCH ? new RegExp(process.env.PROBE_MATCH) : /INV-[0-9]+-r[234]-.*any-build.spec.ts$/,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "off" },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npx next start --port ${PORT}`,
    cwd: process.env.BASELINE_DIR ?? process.cwd(),
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
