/**
 * Review round 3: the probes served from a built export of `main` (BASELINE_DIR), to record what `main` drew. Used by
 * INV-001-narrow-every-size-vs-main.probe.ts with INV001_RECORD=1. Build the export with a real copy of node_modules
 * (Turbopack rejects a junction outside the project root), then:
 *
 *   BASELINE_DIR=<export> INV001_RECORD=1 npx playwright test -c specs/010-wide-reading-layout/review-probes/playwright.baseline.config.ts
 */
import os from "node:os";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PROBE_PORT ?? 3122);
const baseURL = `http://localhost:${PORT}`;
const cwd = process.env.BASELINE_DIR;
if (!cwd) throw new Error("Set BASELINE_DIR to a built export of main");

export default defineConfig({
  testDir: ".",
  outputDir: `${os.tmpdir()}/spec010-baseline-results`,
  testMatch: process.env.PROBE_MATCH ? new RegExp(process.env.PROBE_MATCH) : /INV-001-narrow-every-size-vs-main\.probe\.ts$/,
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "off" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start --port ${PORT}`,
    cwd,
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
