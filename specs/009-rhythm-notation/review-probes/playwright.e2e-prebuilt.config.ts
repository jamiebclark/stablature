// Runs the project's own e2e/ specs (mobile and desktop) against one fresh `npm run build`, for review batches run one
// after another. From the repo root, after `npm run build`, with no dev server holding .next:
//   npx playwright test --config specs/009-rhythm-notation/review-probes/playwright.e2e-prebuilt.config.ts \
//     e2e/notation- --project=mobile --project=desktop < /dev/null
import path from "node:path";
import { defineConfig } from "@playwright/test";
import base from "../../../playwright.config";

const root = path.resolve(__dirname, "../../..");
const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;

export default defineConfig({
  ...base,
  testDir: path.join(root, "e2e"),
  outputDir: path.join(root, "test-results"),
  webServer: server ? { ...server, cwd: root, command: server.command.replace(/^npm run build && /, "") } : undefined,
});
