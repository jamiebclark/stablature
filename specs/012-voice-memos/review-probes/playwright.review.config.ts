/**
 * Spec 012 review: Playwright over this repo's existing `.next` (no rebuild), so the review's own e2e probes and the
 * memo suite can run in slices that each finish inside one command.
 *   npm run build
 *   npx playwright test -c specs/012-voice-memos/review-probes/playwright.review.config.ts --workers=2
 *   REVIEW_DIR=e2e REVIEW_MATCH='memo-[a-z-]+\.spec\.ts$' npx playwright test -c specs/012-voice-memos/review-probes/playwright.review.config.ts
 *
 * REVIEW_DIR=e2e mirrors `playwright.config.ts`: mobile, desktop (minus the memo PHONE_ONLY specs) and `insecure`
 * (memo-unavailable only). The probes run on one fake-microphone phone project.
 */
import os from "node:os";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";
import { FAKE_MICROPHONE } from "../../../e2e/memo-helpers";
import { INSECURE_HOST, INSECURE_HOST_RULE } from "../../../e2e/insecure-host";

const root = path.resolve(__dirname, "../../..");
loadEnv({ path: path.join(root, ".env.local"), override: true, quiet: true });

const PORT = Number(process.env.PROBE_PORT ?? 3412);
const baseURL = `http://localhost:${PORT}`;
const insecureURL = `http://${INSECURE_HOST}:${PORT}`;
const suite = process.env.REVIEW_DIR === "e2e";

const PHONE_ONLY_MEMO = [
  "memo-routes", "memo-recorder", "memo-sync-separate", "memo-band", "memo-band-offline", "memo-delete",
  "memo-refusal", "memo-recover", "memo-full", "memo-persist", "memo-privacy",
  // Round 2: the two specs adopted from round 1's probes (T106, T108), as `playwright.config.ts` lists them.
  "memo-band-race", "memo-push-cross-band",
  // Round 3: the spec adopted from the D6-D8 probe (T115), as `playwright.config.ts` lists it.
  "memo-delete-paths",
  // Round 4: the spec adopted from the FR-036 probe (T119), as `playwright.config.ts` lists it.
  "memo-retry",
].map((name) => `**/${name}.spec.ts`);

export default defineConfig({
  testDir: suite ? path.join(root, "e2e") : __dirname,
  outputDir: path.join(os.tmpdir(), "spec012-review-results"),
  testMatch: process.env.REVIEW_MATCH ? new RegExp(process.env.REVIEW_MATCH) : /\.spec\.ts$/,
  fullyParallel: true,
  retries: 0,
  reporter: "line",
  timeout: 180_000,
  use: { baseURL, trace: "off" },
  projects: suite
    ? [
        { name: "mobile", use: { ...devices["Pixel 7"] }, testIgnore: /wide-sideways-firefox\.spec\.ts/ },
        { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: [...PHONE_ONLY_MEMO, "**/wide-sideways-firefox.spec.ts"] },
        {
          name: "insecure",
          testMatch: /memo-unavailable\.spec\.ts/,
          use: { ...devices["Desktop Chrome"], baseURL: insecureURL, launchOptions: { args: [INSECURE_HOST_RULE] } },
        },
      ]
    : [
        {
          name: "mobile",
          use: { ...devices["Pixel 7"], permissions: ["microphone"], launchOptions: { args: FAKE_MICROPHONE } },
        },
      ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    cwd: root,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      BETTER_AUTH_URL: baseURL,
      STABLATURE_TRUSTED_ORIGINS: `${baseURL},${insecureURL}`,
      STABLATURE_AUTH_RATE_LIMIT: "off",
    },
  },
});
