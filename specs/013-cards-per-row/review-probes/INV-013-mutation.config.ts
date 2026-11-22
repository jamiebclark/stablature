import { defineConfig } from "@playwright/test";
import base from "../../../playwright.config";

/**
 * Review round 4: the project's own suite run through INV-013-mutation-proxy.mjs, so an adopted test can be shown to
 * FAIL against a mutated stylesheet, with no source file edited. Needs one `npx next build` first.
 *
 *   MUTATION=own-head-print npx playwright test -c specs/013-cards-per-row/review-probes/INV-013-mutation.config.ts \
 *     --project=desktop e2e/cards-print -g "real-print layout" < /dev/null
 *
 * MUTATION=none is the control: the same run must pass.
 */
const UP = Number(process.env.E2E_PORT ?? 3117);
const PROXY = UP + 1;
const baseURL = `http://localhost:${PROXY}`;
export default defineConfig({
  ...base,
  // PROBES=1 runs this directory's `*.probe.ts` (projects `desktop`, `mobile`, `firefox`) instead of `e2e/`.
  testDir: process.env.PROBES ? "." : "../../../e2e",
  ...(process.env.PROBES ? { testMatch: /\.probe\.ts$/ } : {}),
  reporter: "list",
  use: { ...base.use, baseURL },
  webServer: [
    {
      command: `npx next start --port ${UP}`,
      cwd: "../../..",
      url: `http://localhost:${UP}`,
      reuseExistingServer: false,
      timeout: 240_000,
      env: { BETTER_AUTH_URL: baseURL, STABLATURE_TRUSTED_ORIGINS: baseURL, STABLATURE_AUTH_RATE_LIMIT: "off" },
    },
    {
      command: `node INV-013-mutation-proxy.mjs ${PROXY} ${UP} ${process.env.MUTATION ?? "none"}`,
      cwd: ".",
      url: baseURL,
      reuseExistingServer: false,
      timeout: 240_000,
      stdout: "pipe",
    },
  ],
});
