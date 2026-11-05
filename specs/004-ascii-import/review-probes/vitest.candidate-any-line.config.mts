/**
 * Round 8. A feasibility check, not a fix. This adds one test to `decide` in `parse.ts`, in memory,
 * and runs every unit probe and the project's reader, write and export suites. Nothing on disk
 * changes.
 *
 *   npx vitest run --config specs/004-ascii-import/review-probes/vitest.candidate-any-line.config.mts
 *
 * The rule (F70): S6 asks whether a line is made only of the notation, and S5 asks what a line
 * holds, so a line S5 calls a row beside a block is commentary away from one. This asks one question
 * of a line wherever it sits: a note touches a rail, long dash, minus sign or pipe, and the line is
 * not prose. A line of only numbers, `x` and hyphens also needs a line touching it that holds a rail,
 * or a rail at its own edge. A pipe touching a rail or a note is a row whatever else the line holds.
 * So `G:-3-5-3-7-`, `E:|--3--5--|`, `Guitar|--3--5--|`, `1 3-5-3-7` over `2 -------` and
 * `———5———7———` each start a block, and `1-2-3-4`, `12-16`, `1 - 4`, `x2`, `Am7 - D7` and `Verse 1 -`
 * stay commentary. The note must touch: a rail standing apart, as ` - ` between two chords, is prose
 * punctuation, and S5 still takes such a line beside a block. S5 then grows the block unchanged. The
 * minus sign joins the rails in `readsAsProse`, so all four spellings agree.
 */
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname, "../../..");

const CLAIM = "    if (isStaffLine(lines[i]) || seeds) {\n";
const CLAIM_NEW = `    const held = lines[i].trim();
    const note = [...held].some((c, n, all) => {
      const letter = (l: string | undefined) => l !== undefined && /\\p{L}/u.test(l);
      return /\\d/.test(c) || (/[xX]/.test(c) && !letter(all[n - 1]) && !letter(all[n + 1]));
    });
    const railed = (k: number) =>
      k >= 0 && k < lines.length && /[-—–−|]/.test(lines[k]) && !readsAsProse(lines[k]);
    const numbers = /^[\\dxX\\s./:-]+$/.test(held) && !/^[-—–−|]|[-—–−|]$/.test(held);
    const touches = /[-—–−|][0-9xX]|[0-9xX][-—–−|]/.test(held);
    const loose =
      note &&
      (/\\|[-—–−0-9xX]|[-—–−0-9xX]\\|/.test(held) ||
        (touches && railed(i) && (!numbers || railed(i - 1) || railed(i + 1))));
    if (isStaffLine(lines[i]) || loose) {
`;
const PROSE = "if (/^[-\\u2014\\u2013|]|[-\\u2014\\u2013|]$/.test(t)) return false;";
const PROSE_NEW = "if (/^[-\\u2014\\u2013\\u2212|]|[-\\u2014\\u2013\\u2212|]$/.test(t)) return false;";

export default defineConfig({
  cacheDir: path.join(os.tmpdir(), "spec004-candidate-any-line"),
  plugins: [
    react(),
    {
      name: "candidate-any-line",
      enforce: "pre",
      transform(code, id) {
        if (!id.replace(/\\/g, "/").endsWith("src/lib/tab/parse.ts")) return null;
        const source = code.replace(/\r\n/g, "\n");
        if (!source.includes(CLAIM) || !source.includes(PROSE)) {
          throw new Error("the reader has moved, so this no longer applies");
        }
        return source.replace(CLAIM, CLAIM_NEW).replace(PROSE, PROSE_NEW);
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
