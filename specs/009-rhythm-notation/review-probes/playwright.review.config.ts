// Runs the 009 review's browser probes against a production build, with the project's own projects and server.
// From the repo root, with no dev server holding .next:
//   npx playwright test --config specs/009-rhythm-notation/review-probes/playwright.review.config.ts < /dev/null
import path from "node:path";
import { defineConfig } from "@playwright/test";
import base from "../../../playwright.config";

const root = path.resolve(__dirname, "../../..");
const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;

export default defineConfig({
  ...base,
  testDir: __dirname,
  testMatch: /INV-.*\.spec\.ts$/,
  outputDir: path.join(root, "test-results", "review-009"),
  projects: (base.projects ?? []).filter((p) => p.name === "mobile" || p.name === "desktop").map((p) => ({ ...p, testIgnore: undefined })),
  // REVIEW_PREBUILT=1 skips the build, for batches run one after another against one fresh `npm run build`.
  webServer: server
    ? {
        ...server,
        cwd: root,
        command: process.env.REVIEW_PREBUILT ? server.command.replace(/^npm run build && /, "") : server.command,
      }
    : undefined,
});
