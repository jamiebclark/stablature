import { defineConfig } from "@playwright/test";

/**
 * Spec 010 quickstart §1.2: records the narrow layout on the UNEDITED build. Not part of the suite (its testMatch
 * is wide-narrow-record.ts, which the suite's *.spec.ts pattern never picks up). Build first, then:
 * `npx playwright test e2e/wide-narrow-record.ts -c e2e/wide-before.config.ts`.
 */
const PORT = 3111;
export default defineConfig({
  testDir: ".",
  testMatch: /wide-narrow-record\.ts$/,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "record" }],
  webServer: {
    cwd: "..",
    command: `npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      STABLATURE_TRUSTED_ORIGINS: `http://localhost:${PORT}`,
      STABLATURE_AUTH_RATE_LIMIT: "off",
    },
  },
});
