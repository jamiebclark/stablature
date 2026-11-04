/**
 * Review probes for spec 003-generalised-grouping.
 *
 * Playwright owns the server: it serves this repo's existing `.next` with `next start`, so build
 * first (`npm run build`). `run-probes.sh` does both. PROBE_MATCH narrows it by filename regex.
 */
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PROBE_PORT ?? 3303);
const baseURL = `http://localhost:${PORT}`;
// PROBE_ROOT serves another checkout: a build of main, for "is this the branch's doing?".
const root = process.env.PROBE_ROOT ?? path.resolve(__dirname, "../../..");

export default defineConfig({
  testDir: ".",
  // Outside the repo: probe artefacts are not part of the working tree.
  outputDir: path.join(os.tmpdir(), "spec003-probe-results"),
  testMatch: process.env.PROBE_MATCH
    ? new RegExp(process.env.PROBE_MATCH)
    : /(INV|FR)-.*\.spec\.ts$/,
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
