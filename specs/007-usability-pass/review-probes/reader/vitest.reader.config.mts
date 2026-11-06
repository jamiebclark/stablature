import path from "node:path";
import { defineConfig } from "vitest/config";

const repo = path.resolve(import.meta.dirname, "../../../..");
const source = process.env.READER_ROOT ?? repo;

export default defineConfig({
  root: repo,
  server: { fs: { strict: false } },
  test: {
    globals: true,
    environment: "node",
    include: ["specs/007-usability-pass/review-probes/reader/*.test.ts"],
  },
  resolve: { alias: { "@": path.join(source, "src") } },
});
