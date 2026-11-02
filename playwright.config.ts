import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// The sync specs talk to Postgres directly to verify rows actually landed.
loadEnv({ path: ".env.local", override: true, quiet: true });

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Each test gets its own browser context, so IndexedDB is already isolated
  // between them and they can run in parallel against one dev server.
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    // Capture is a phone screen first, so that is the primary target.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  // Tested against a production build, not `next dev`. Dev compiles routes on
  // demand, so the first parallel test to reach a cold route waits seconds for
  // a build and fails on timing rather than on behaviour. A real build also
  // matches what actually gets self-hosted.
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: baseURL,
    /*
     * Never reuse. An interrupted run can orphan a `next start` on this port,
     * and every later run then silently tests that stale build instead of the
     * working tree -- a suite that passes against code you did not write is
     * worse than one that fails. Rebuilding costs about twenty seconds.
     */
    reuseExistingServer: false,
    timeout: 240_000,
    // The test server runs on its own port, which is a different origin from
    // whatever BETTER_AUTH_URL says in .env.local. Better Auth rejects
    // unlisted origins outright, so sign-in would fail with "Invalid origin" --
    // the same thing that happens on a LAN when you reach the app by IP.
    env: {
      BETTER_AUTH_URL: baseURL,
      STABLATURE_TRUSTED_ORIGINS: baseURL,
      // The suite signs up a dozen throwaway accounts from one address, which
      // trips the per-IP limit that protects the real credential endpoints.
      STABLATURE_AUTH_RATE_LIMIT: "off",
    },
  },
});
