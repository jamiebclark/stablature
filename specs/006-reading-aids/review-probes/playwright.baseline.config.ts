/**
 * The same browser probes, served from an export of another tree: `BASELINE_DIR` holds a built copy of `main`.
 *
 * Used to tell a defect of this branch from one that was already there. `PROBE_MATCH` narrows it as in
 * `playwright.probes.config.ts`, and must end in `\.spec\.ts$`.
 */
import os from "node:os";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

const root = path.resolve(__dirname, "../../..");
loadEnv({ path: path.join(root, ".env.local"), override: true, quiet: true });

const PORT = Number(process.env.PROBE_PORT ?? 3307);
const baseURL = `http://localhost:${PORT}`;
const cwd = process.env.BASELINE_DIR;
if (!cwd) throw new Error("Set BASELINE_DIR to a built export of the tree to serve");

export default defineConfig({
  testDir: ".",
  outputDir: path.join(os.tmpdir(), "spec006-baseline-results"),
  testMatch: process.env.PROBE_MATCH ? new RegExp(process.env.PROBE_MATCH) : /INV-.*\.spec\.ts$/,
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  timeout: 120_000,
  use: { baseURL, trace: "off" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    cwd,
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
