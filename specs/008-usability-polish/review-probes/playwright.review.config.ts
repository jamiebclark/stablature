import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

/**
 * Review only (spec 008): runs the review probes in this folder, and the repo's own e2e specs by path, against
 * the production build already in .next (no rebuild: run `npm run build` first), on its own port.
 *
 *   npx playwright test --config specs/008-usability-polish/review-probes/playwright.review.config.ts <filter>
 */
loadEnv({ path: ".env.local", override: true, quiet: true });

const PORT = Number(process.env.REVIEW_PORT ?? 3119);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "../../..",
  testMatch: [/e2e[\/][^\/]+\.spec\.ts$/, /review-probes[\/][^\/]+\.probe\.ts$/],
  testIgnore: ["**/node_modules/**"],
  fullyParallel: true,
  workers: 4,
  reporter: "list",
  use: { baseURL },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // As the main config: the staff layout also runs in Firefox.
    { name: "firefox", testMatch: /usability-staves.spec.ts/, use: { ...devices["Desktop Firefox"], viewport: { width: 412, height: 915 } } },
  ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    cwd: "../../..",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { BETTER_AUTH_URL: baseURL, STABLATURE_TRUSTED_ORIGINS: baseURL, STABLATURE_AUTH_RATE_LIMIT: "off" },
  },
});
