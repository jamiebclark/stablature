/**
 * Spec 012 review probes (unit tier). Run from the repo root:
 *   npx vitest run --config specs/012-voice-memos/review-probes/vitest.probes.config.mts
 */
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname, "../../..");

export default defineConfig({
  plugins: [react()],
  root,
  test: {
    globals: true,
    environment: "node",
    include: ["specs/012-voice-memos/review-probes/**/*.test.{ts,tsx}"],
    setupFiles: [path.join(root, "vitest.setup.ts")],
    testTimeout: 60_000,
  },
  resolve: {
    alias: { "@": path.join(root, "src") },
  },
});
