import { defineConfig, devices } from "@playwright/test";

/** Research only: reuses the production build already in .next (no rebuild), on its own port. */
const PORT = 3108;
export default defineConfig({
  testDir: ".",
  testMatch: /measure\.probe\.ts/,
  workers: 2,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    cwd: "../../..",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { BETTER_AUTH_URL: `http://localhost:${PORT}`, STABLATURE_TRUSTED_ORIGINS: `http://localhost:${PORT}` },
  },
});
