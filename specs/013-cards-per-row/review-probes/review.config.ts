import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

loadEnv({ path: "../../../.env.local", override: true, quiet: true });

/**
 * Spec 013 review probes, plus the feature's own e2e specs run against one server.
 *
 *   npx next build                      # once, from the repo root
 *   cd specs/013-cards-per-row/review-probes
 *   PROBE_NO_BUILD=1 npx playwright test -c review.config.ts --project probe-desktop < /dev/null
 *   PROBE_NO_BUILD=1 npx playwright test -c review.config.ts --project e2e-desktop cards-rows < /dev/null
 *
 * `probe-*` projects run this directory's `*.probe.ts`; `e2e-*` projects run `e2e/` as the suite has it.
 */
const PORT = Number(process.env.PROBE_PORT ?? 3114);
const baseURL = `http://localhost:${PORT}`;
const probe = { testDir: ".", testMatch: /\.probe\.ts$/ };
const e2e = { testDir: "../../../e2e" };
export default defineConfig({
  fullyParallel: true,
  reporter: "list",
  timeout: 300_000,
  use: { baseURL },
  projects: [
    { name: "probe-desktop", ...probe, use: { ...devices["Desktop Chrome"] } },
    { name: "probe-mobile", ...probe, use: { ...devices["Pixel 7"] } },
    { name: "probe-firefox", ...probe, use: { ...devices["Desktop Firefox"], viewport: { width: 412, height: 915 } } },
    { name: "e2e-desktop", ...e2e, use: { ...devices["Desktop Chrome"] } },
    { name: "e2e-mobile", ...e2e, use: { ...devices["Pixel 7"] } },
    { name: "e2e-firefox", ...e2e, use: { ...devices["Desktop Firefox"], viewport: { width: 412, height: 915 } } },
  ],
  webServer: {
    command: process.env.PROBE_NO_BUILD ? `npx next start --port ${PORT}` : `npx next build && npx next start --port ${PORT}`,
    cwd: "../../..",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 400_000,
    env: {
      BETTER_AUTH_URL: baseURL,
      STABLATURE_TRUSTED_ORIGINS: baseURL,
      STABLATURE_AUTH_RATE_LIMIT: "off",
    },
  },
});
