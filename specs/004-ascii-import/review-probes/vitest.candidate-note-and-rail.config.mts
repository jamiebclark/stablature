/**
 * Round 5. A feasibility check, not a fix. T078's walk stays. This swaps one line of `decide`, in
 * memory, and runs every unit probe and the project's reader, write and export suites. Nothing on
 * disk changes.
 *
 *   npx vitest run --config specs/004-ascii-import/review-probes/vitest.candidate-note-and-rail.config.mts
 *
 * The row test stops asking what a note touches. A line touching a block is a row when it holds a
 * note (a digit or `x`) and a rail or pipe, unless it is positively prose. The mark test stays beside
 * it for rows whose rails are gone, as `−5−7−`. A note name no longer counts as a word, so `Eb:5-7` needs
 * no label set aside. Nothing else moves.
 */
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname, "../../..");

const LINE =
  "const can = isNotationOnly(lines[i]) || (!empty && readsAsBlockRow(lines[i]) && !readsAsProse(lines[i]));";

const SWAP = `const can =
      isNotationOnly(lines[i]) ||
      (!empty && (readsAsBlockRow(lines[i]) || HOLDS_RAIL.test(lines[i])) && !readsAsProse(lines[i]));`;

const WORD_OLD =
  'const body = t.replace(/^[A-Ga-g][#b\\u266F\\u266D]{0,2}\\d?\\s+/, "");';
const WORD_OLD_TEST = 'return /(?<![\\p{L}\\p{N}])\\p{L}{2,}(?![\\p{L}\\p{N}])/u.test(body);';

const WORD_NEW = `return [...t.matchAll(/(?<![\\p{L}\\p{N}])\\p{L}{2,}(?![\\p{L}\\p{N}])/gu)].some((m) => !NOTE_NAME.test(m[0]));`;

const ADDED = `
const HOLDS_RAIL = /[-\\u2014\\u2013|]/;
`;

export default defineConfig({
  cacheDir: path.join(os.tmpdir(), "spec004-candidate-note-and-rail"),
  plugins: [
    react(),
    {
      name: "candidate-note-and-rail",
      enforce: "pre",
      transform(code, id) {
        if (!id.replace(/\\/g, "/").endsWith("src/lib/tab/parse.ts")) return null;
        for (const piece of [LINE, WORD_OLD, WORD_OLD_TEST]) {
          if (!code.includes(piece)) throw new Error("the classifier has moved, so this no longer applies");
        }
        return code.replace(LINE, SWAP).replace(WORD_OLD, "").replace(WORD_OLD_TEST, WORD_NEW) + ADDED;
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
