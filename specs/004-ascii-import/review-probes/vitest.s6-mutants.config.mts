/**
 * Round 9. Round 8 said no mutant broke line classification, so a green suite said little about it.
 * This breaks S6 in one way, chosen by S6_MUTANT, in memory, and runs the project's own tab, local,
 * export and panel suites. A mutant nothing kills is a part of the rule no test holds in place.
 * `without-s6` removes the rule, for measuring what it costs: run it against
 * INV-010-ordinary-lines-anywhere.test.ts with S6_INCLUDE=probe.
 *
 *   S6_MUTANT=no-touch npx vitest run --config specs/004-ascii-import/review-probes/vitest.s6-mutants.config.mts
 */
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname, "../../..");

const MUTANTS: Record<string, [string, string]> = {
  // Removes the rule whole.
  "without-s6": ["if (isStaffLine(lines[i]) || loose) {", "if (isStaffLine(lines[i])) {"],
  // A line need not hold a note.
  "no-note": ["      (note || touches) &&\n      (/\\|", "      (/\\|"],
  // A run need not hold both, which F73 measured at 23 of 64 ordinary lines.
  "no-touch": ["(touches && railed(i) &&", "(railed(i) &&"],
  // Prose is no longer asked about.
  "no-prose": ["(touches && railed(i) &&", "(touches &&"],
  // A line of only numbers needs no neighbour, so `1-2-3-4` alone refuses.
  "no-numbers-guard": ["(!numbers || railed(i - 1) || railed(i + 1))", "true"],
  // Only the line above counts as a neighbour.
  "numbers-above-only": ["(!numbers || railed(i - 1) || railed(i + 1))", "(!numbers || railed(i - 1))"],
  // Only the line below counts as a neighbour.
  "numbers-below-only": ["(!numbers || railed(i - 1) || railed(i + 1))", "(!numbers || railed(i + 1))"],
  // The pipe rule goes, so `Guitar|--3--5--` is prose again.
  "no-pipe-rule": ["(/\\|[-—–−0-9xX]|[-—–−0-9xX]\\|/.test(held) ||\n", "(false ||\n"],
  // The long dashes leave the note test.
  "touch-hyphen-only": ["some((k) => /[-—–−|]/.test(k) && inRun(k));", "some((k) => /[-|]/.test(k) && inRun(k));"],
  // The minus sign leaves the edge test of prose.
  "prose-edge-no-minus": ["if (/^[-\\u2014\\u2013\\u2212|]|[-\\u2014\\u2013\\u2212|]$/.test(t)) return false;", "if (/^[-\\u2014\\u2013|]|[-\\u2014\\u2013|]$/.test(t)) return false;"],
  // Round 10, T091's rule. The line is the unit again, so a rail standing apart counts.
  "line-not-run": ["const touches = held.split(/\\s+/).some(", "const touches = [held].some("],
  // A free `x` in a run is no longer a note.
  "run-digits-only": ["/\\d|(?<!\\p{L})[xX](?!\\p{L})/u.test(k) ||", "/\\d/.test(k) ||"],
  // An `x` beside a letter, as `-xb-` and `-tx-`, is no longer a note.
  "no-notation-x": [" || (isNotationOnly(k) && /[xX]/.test(k));", ";"],
  // A free `x` is no longer a note.
  "digits-only": ["return /\\d/.test(c) || (/[xX]/.test(c) && !letter(all[n - 1]) && !letter(all[n + 1]));", "return /\\d/.test(c);"],
};

const mutant = process.env.S6_MUTANT ?? "";
const probe = process.env.S6_INCLUDE === "probe";

export default defineConfig({
  cacheDir: path.join(os.tmpdir(), "spec004-s6-mutants", mutant || "control"),
  plugins: [
    react(),
    {
      name: "mutate-s6",
      enforce: "pre",
      transform(code, id) {
        if (!id.replace(/\\/g, "/").endsWith("src/lib/tab/parse.ts") || !mutant) return null;
        const source = code.replace(/\r\n/g, "\n");
        const [from, to] = MUTANTS[mutant];
        if (!source.includes(from)) throw new Error(`mutant ${mutant} no longer applies`);
        return source.replace(from, to);
      },
    },
  ],
  root,
  test: {
    globals: true,
    environment: "node",
    include: probe
      ? ["specs/004-ascii-import/review-probes/INV-010-ordinary-lines-anywhere.test.ts"]
      : [
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
