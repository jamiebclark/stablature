/**
 * Round 6. A feasibility check, not a fix. This swaps two lines of `parse.ts`, in memory, and runs
 * every unit probe and the project's reader, write and export suites. Nothing on disk changes.
 *
 *   npx vitest run --config specs/004-ascii-import/review-probes/vitest.candidate-every-note.config.mts
 *
 * Two guards, each one line, both refusing as `run-together`. A note-name label ending in a digit
 * with no pipe after it may be a label or a first fret, so it is not guessed at (F63). A fret written
 * with a leading zero is two notes with no gap, or a fret drawn other than as written (F64).
 */
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname, "../../..");

const LABEL = "    row.label = named[1];\n";
const LABEL_NEW = `    row.label = named[1];\n    if (/\\d$/.test(named[1])) fail("run-together");\n`;

const CORE = "  const coreText = core[0];\n";
const CORE_NEW = `  const coreText = core[0];\n  if (/^0\\d/.test(coreText)) return { ok: false, code: "run-together" };\n`;

export default defineConfig({
  cacheDir: path.join(os.tmpdir(), "spec004-candidate-every-note"),
  plugins: [
    react(),
    {
      name: "candidate-every-note",
      enforce: "pre",
      transform(code, id) {
        if (!id.replace(/\\/g, "/").endsWith("src/lib/tab/parse.ts")) return null;
        const source = code.replace(/\r\n/g, "\n");
        for (const piece of [LABEL, CORE]) {
          if (!source.includes(piece)) throw new Error("the reader has moved, so this no longer applies");
        }
        return source.replace(LABEL, LABEL_NEW).replace(CORE, CORE_NEW);
      },
    },
  ],
  root,
  test: {
    globals: true,
    environment: "node",
    include: [
      "specs/004-ascii-import/review-probes/**/*.test.{ts,tsx}",
      "src/lib/tab/__tests__/**/*.test.ts",
      "src/lib/local/__tests__/**/*.test.ts",
      "src/lib/export/__tests__/**/*.test.ts",
      "src/components/app/__tests__/**/*.test.tsx",
    ],
    setupFiles: ["fake-indexeddb/auto", path.join(root, "vitest.setup.ts")],
    testTimeout: 300_000,
    experimental: { fsModuleCache: false } as object,
  },
  resolve: {
    alias: { "@": path.join(root, "src") },
  },
});
