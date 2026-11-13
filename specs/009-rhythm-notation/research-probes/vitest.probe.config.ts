// Runs the research probes in this folder with the project's own aliases and setup.
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
    include: ["specs/009-rhythm-notation/research-probes/*.test.{ts,tsx}"],
    setupFiles: [path.join(root, "vitest.setup.ts")],
  },
  resolve: {
    alias: { "@": path.join(root, "src") },
  },
});
