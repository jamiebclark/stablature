import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// The sync specs talk to Postgres directly to verify rows actually landed.
loadEnv({ path: ".env.local", override: true, quiet: true });

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * Specs whose outcome does not depend on screen size or pointer type, so the desktop project skips them.
 * A new spec runs on both until it is added here.
 */
const PHONE_ONLY = [
  "capture.spec.ts",
  "click-offline.spec.ts",
  "click-offline-arrivals.spec.ts",
  "durations-layout.spec.ts",
  "grouping-band.spec.ts",
  "grouping-connector.spec.ts",
  "grouping-controls.spec.ts",
  "grouping-cursor-names.spec.ts",
  "grouping-glyph.spec.ts",
  "grouping-paint.spec.ts",
  "grouping-queued-row.spec.ts",
  "grouping-refusal.spec.ts",
  "grouping-surfaces.spec.ts",
  "grouping-sync.spec.ts",
  "import-edge-damage-review.spec.ts",
  "import-every-cell-review.spec.ts",
  "import-every-label-review.spec.ts",
  "import-every-system-review.spec.ts",
  "import-label-fret-review.spec.ts",
  "import-layout.spec.ts",
  "import-layout-review.spec.ts",
  "import-silent-shift-review.spec.ts",
  "import-sync.spec.ts",
  "import-sync-review.spec.ts",
  "import-touching-a-staff-review.spec.ts",
  "import-wrapped-row-review.spec.ts",
  "import-zeros-review.spec.ts",
  "offline.spec.ts",
  "reading-view.spec.ts",
  "rhythm-lit-and-nowhere-else.spec.ts",
  "rhythm-marks.spec.ts",
  "rhythm-unknown-values.spec.ts",
  "sync.spec.ts",
  "sync-no-lost-rows.spec.ts",
  "techniques.spec.ts",
  "techniques-layout.spec.ts",
  "techniques-one-shot-pairs.spec.ts",
  "techniques-positions.spec.ts",
  "techniques-surfaces.spec.ts",
  "techniques-targets-routes.spec.ts",
  "usability-bars-sections.spec.ts",
  "usability-contrast.spec.ts",
  "usability-neck.spec.ts",
  "variant-marks.spec.ts",
  "variant-marks-paint.spec.ts",
];

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
    // Only what a desktop can do differently: keys, a mouse, hover, a fine pointer's density, a wide layout.
    // Specs of sync, import, data and touch-only flows run once, on the phone.
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: PHONE_ONLY.map((name) => `**/${name}`) },
    // Firefox sizes a flex line from its items' content, not their flex-basis, so a bar in the play view
    // came out narrower than its columns and hid its last note. The staff layout runs there too.
    {
      name: "firefox",
      testMatch: /usability-staves\.spec\.ts/,
      use: { ...devices["Desktop Firefox"], viewport: { width: 412, height: 915 } },
    },
    // A screen with no touch and no hover-less pointer ambiguity: the density pass reads sizes as a mouse
    // user sees them, so Chromium is told the primary pointer is a mouse and hover works.
    {
      name: "no-pointer",
      testMatch: /usability-density\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--blink-settings=primaryPointerType=1,availablePointerTypes=1,primaryHoverType=1,availableHoverTypes=1"],
        },
      },
    },
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
