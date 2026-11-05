/**
 * Round 4. Was the S5 change in T073 what moved these results? This runs the round 4 probes with the
 * one test T073 changed put back as T065 wrote it: a line joins a block only if it is made of the
 * notation's own characters. An in-memory transform of parse.ts: nothing on disk changes.
 *
 *   npx vitest run --config specs/004-ascii-import/review-probes/vitest.t065-rule.config.mts
 */
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname, "../../..");

const FROM = "if (empty ? !isNotationOnly(lines[i]) : !readsAsBlockRow(lines[i])) continue;";
const TO = "if (!isNotationOnly(lines[i])) continue;";

export default defineConfig({
  cacheDir: path.join(os.tmpdir(), "spec004-t065-rule"),
  plugins: [
    react(),
    {
      name: "t065-rule",
      enforce: "pre",
      transform(code, id) {
        if (!id.replace(/\\/g, "/").endsWith("src/lib/tab/parse.ts")) return null;
        if (!code.includes(FROM)) throw new Error("the S5 line has moved, so this no longer applies");
        return code.replace(FROM, TO);
      },
    },
  ],
  root,
  test: {
    globals: true,
    environment: "node",
    include: [
      "specs/004-ascii-import/review-probes/INV-006-009-every-written-row.test.ts",
      "specs/004-ascii-import/review-probes/INV-010-touching-a-staff.test.ts",
    ],
    setupFiles: ["fake-indexeddb/auto", path.join(root, "vitest.setup.ts")],
    testTimeout: 300_000,
    experimental: { fsModuleCache: false } as object,
  },
  resolve: {
    alias: { "@": path.join(root, "src") },
  },
});
