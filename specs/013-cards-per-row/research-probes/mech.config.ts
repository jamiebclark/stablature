import { defineConfig, devices } from "@playwright/test";

/** Spec 013 research R1 and R3: the static probes, in both engines. No server. */
export default defineConfig({
  testDir: ".",
  testMatch: /(flex-mechanism|ruler-calc)\.probe\.ts$/,
  workers: 1,
  reporter: "list",
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});
