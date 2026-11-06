import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
const root = process.env.REPO_ROOT!;
export default defineConfig({
  plugins: [react()],
  root,
  server: { fs: { strict: false } },
  test: { globals: true, environment: "node", include: ["specs/004-ascii-import/review-probes/INV-014-030-*.test.ts"], setupFiles: ["fake-indexeddb/auto", path.join(root, "vitest.setup.ts")], testTimeout: 300_000 },
  resolve: { alias: { "@": path.join(process.env.READER_ROOT!, "src") } },
});
