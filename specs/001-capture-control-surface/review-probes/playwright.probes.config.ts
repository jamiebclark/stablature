/**
 * Review probes for spec 001-capture-control-surface.
 *
 * Same browsers as the project suite (`playwright.config.ts`), but no
 * webServer: `run-probes.sh` builds once, starts `next start` on PROBE_PORT,
 * runs this config, and stops the server -- all in one synchronous command.
 *
 *   bash specs/001-capture-control-surface/review-probes/run-probes.sh [--no-build] [playwright args]
 */
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PROBE_PORT ?? 3300);

export default defineConfig({
  testDir: ".",
  // Outside the repo: probe artefacts are not part of the working tree.
  outputDir: process.env.PROBE_OUT ?? path.join(os.tmpdir(), "spec001-probe-results"),
  testMatch: /(INV|FR)-.*\.spec\.ts$/,
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "off" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
