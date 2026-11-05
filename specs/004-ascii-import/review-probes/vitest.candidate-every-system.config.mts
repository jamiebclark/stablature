/**
 * Round 7. A feasibility check, not a fix. This adds one test to `decide` in `parse.ts`, in memory,
 * and runs every unit probe and the project's reader, write and export suites. Nothing on disk
 * changes.
 *
 *   npx vitest run --config specs/004-ascii-import/review-probes/vitest.candidate-every-system.config.mts
 *
 * The rule (F66): a line that, with any leading note name and spaces set aside, is made only of the
 * notation's characters and holds a note is a staff row in its own right when it opens or closes on
 * a rail or pipe, or touches another such line, so it can start a block. `-3-3-5-5-3-`, `--3--5--|`,
 * `3-5-3-7` under a rails-only row and `G 3-5-3-7` over `D 3-5-3-7` each start one. `1-2-3-4` alone
 * touches nothing and opens and closes on a digit, so it stays commentary. S5 then grows the block
 * over its rails-only rows unchanged.
 */
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname, "../../..");

const CLAIM = "    if (isStaffLine(lines[i])) {\n";
const CLAIM_NEW = `    const body = (k: number) => lines[k].trim().replace(/^[A-Ga-g][#b♯♭]{0,2}\\d?\\s+/, "");
    const bare = (k: number) => k >= 0 && k < lines.length && isNotationOnly(body(k));
    const seeds =
      bare(i) && /[0-9xX]/.test(body(i)) && (/^-|[-|]$/.test(body(i)) || bare(i - 1) || bare(i + 1));
    if (isStaffLine(lines[i]) || seeds) {
`;

export default defineConfig({
  cacheDir: path.join(os.tmpdir(), "spec004-candidate-every-system"),
  plugins: [
    react(),
    {
      name: "candidate-every-system",
      enforce: "pre",
      transform(code, id) {
        if (!id.replace(/\\/g, "/").endsWith("src/lib/tab/parse.ts")) return null;
        const source = code.replace(/\r\n/g, "\n");
        if (!source.includes(CLAIM)) throw new Error("the reader has moved, so this no longer applies");
        return source.replace(CLAIM, CLAIM_NEW);
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
