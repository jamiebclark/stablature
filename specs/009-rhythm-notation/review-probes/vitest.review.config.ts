// Runs the 009 review probes in this folder with the project's own aliases and setup.
// npx vitest run --config specs/009-rhythm-notation/review-probes/vitest.review.config.ts < /dev/null
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname, "../../..");

export default defineConfig({
  root,
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    include: ["specs/009-rhythm-notation/review-probes/*.test.{ts,tsx}"],
    setupFiles: [path.join(root, "vitest.setup.ts")],
    testTimeout: 300_000,
  },
  resolve: {
    alias: { "@": path.join(root, "src") },
  },
});
