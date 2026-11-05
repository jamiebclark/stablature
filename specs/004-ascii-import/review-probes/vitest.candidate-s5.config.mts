/**
 * Round 4. A feasibility check, not a fix. T065's S5 rule fails round 3's probes and T073's fails
 * round 4's, so before asking for both, this checks that one rule can hold them together. It swaps
 * the S5 test for a candidate in memory and runs every unit probe and the project's reader, write
 * and export suites. Nothing on disk changes.
 *
 *   npx vitest run --config specs/004-ascii-import/review-probes/vitest.candidate-s5.config.mts
 *
 * The candidate asks what T073 asked, the other way up. Anything the notation can write is a row,
 * with no further question. Past that, a line with a digit or free `x` touching a mark is a row
 * unless it is positively prose: it neither opens nor closes on a rail or pipe, and it is one chord
 * symbol or holds a word, meaning two or more letters touching no digit.
 */
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname, "../../..");

const FROM = "if (empty ? !isNotationOnly(lines[i]) : !readsAsBlockRow(lines[i])) continue;";
const TO =
  "if (!isNotationOnly(lines[i]) && (empty || !readsAsBlockRow(lines[i]) || readsAsProse(lines[i]))) continue;";
const PROSE = `
function readsAsProse(raw: string): boolean {
  const t = raw.trim();
  if (/^[-\\u2014\\u2013|]|[-\\u2014\\u2013|]$/.test(t)) return false;
  return isChord(t) || /(?<![\\p{L}\\p{N}])\\p{L}{2,}(?![\\p{L}\\p{N}])/u.test(t);
}
`;

export default defineConfig({
  cacheDir: path.join(os.tmpdir(), "spec004-candidate-s5"),
  plugins: [
    react(),
    {
      name: "candidate-s5",
      enforce: "pre",
      transform(code, id) {
        if (!id.replace(/\\/g, "/").endsWith("src/lib/tab/parse.ts")) return null;
        if (!code.includes(FROM)) throw new Error("the S5 line has moved, so this no longer applies");
        return code.replace(FROM, TO) + PROSE;
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
