import { defineConfig } from "@playwright/test";
import base from "../../../playwright.config";

/**
 * The project's own suite (its projects, PHONE_ONLY skips and firefox testMatch) against a server started from an
 * existing build, so the review can run the suite in chunks under the 10-minute command limit:
 *
 *   npx next build                                    # once
 *   E2E_PORT=3115 npx playwright test -c specs/013-cards-per-row/review-probes/suite.config.ts \
 *     --project=mobile --project=desktop wide- play- < /dev/null
 */
const PORT = Number(process.env.E2E_PORT ?? 3115);
const baseURL = `http://localhost:${PORT}`;
export default defineConfig({
  ...base,
  testDir: "../../../e2e",
  reporter: "list",
  webServer: {
    command: `npx next start --port ${PORT}`,
    cwd: "../../..",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      BETTER_AUTH_URL: baseURL,
      STABLATURE_TRUSTED_ORIGINS: baseURL,
      STABLATURE_AUTH_RATE_LIMIT: "off",
    },
  },
});
