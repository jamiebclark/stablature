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
    include: ["specs/002-playing-techniques/review-probes/**/*.test.{ts,tsx}"],
    setupFiles: [path.join(root, "vitest.setup.ts")],
  },
  resolve: {
    alias: { "@": path.join(root, "src") },
  },
});
