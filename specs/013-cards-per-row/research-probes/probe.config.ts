import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

loadEnv({ path: "../../../.env.local", override: true, quiet: true });

/**
 * Spec 013 research: the fit figures under per-card sizing, measured on the UNEDITED tree with the candidate CSS
 * injected. Not part of the suite. Run: `npx playwright test -c specs/013-cards-per-row/research-probes/probe.config.ts`.
 */
const PORT = 3113;
export default defineConfig({
  testDir: ".",
  testMatch: /(measure-rows|measure-final|long-ruler|song-head)\.probe\.ts$/,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.PROBE_NO_BUILD ? `npx next start --port ${PORT}` : `npx next build && npx next start --port ${PORT}`,
    cwd: "../../..",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 400_000,
    env: {
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      STABLATURE_TRUSTED_ORIGINS: `http://localhost:${PORT}`,
      STABLATURE_AUTH_RATE_LIMIT: "off",
    },
  },
});
