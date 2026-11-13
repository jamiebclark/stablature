import { defineConfig, devices } from "@playwright/test";

/**
 * Spec 008 T001: records "today" before any source edit. Not part of the suite (playwright.config.ts matches
 * only *.spec.ts); run it once against a fresh build: `npx playwright test -c e2e/polish-before.config.ts`.
 */
const PORT = 3109;
export default defineConfig({
  testDir: ".",
  testMatch: /polish-before\.record\.ts/,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npx next start --port ${PORT}`,
    cwd: "..",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { BETTER_AUTH_URL: `http://localhost:${PORT}`, STABLATURE_TRUSTED_ORIGINS: `http://localhost:${PORT}` },
  },
});
