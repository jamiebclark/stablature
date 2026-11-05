/**
 * Round 4. A feasibility check, not a fix, and not a rule to copy. `vitest.candidate-s5.config.mts`
 * changed the S5 test alone and failed: it dropped `Eb 5-7-5` again and refused chord rows above a
 * block that grew. This asks whether the shape of the classifier was the trouble. It swaps the
 * classification in `parse()`, in memory, for three structural moves and runs every unit probe and
 * the project's reader, write and export suites. Nothing on disk changes.
 *
 *   npx vitest run --config specs/004-ascii-import/review-probes/vitest.candidate-walk.config.mts
 *
 *   1. One walk decides every line kind, so a chord or bracket test sees the block as it grew.
 *   2. Sweeps alternate direction, so a block grows whole in one sweep and stacked lines stay linear.
 *   3. Anything the notation can write is a row with no further question (`isNotationOnly`).
 *      Past that, a line is a damaged row only if a digit or free `x` touches a mark and it is not
 *      positively something else: a line of only numbers and `. / :`, a line of chord symbols, or a
 *      word of two or more letters once a leading note-name label is set aside.
 */
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname, "../../..");

const START = "  // Bottom-up: a bracket row is classified before a staff row";
const END = '  if (!isStaff.some(Boolean)) return failed([refusal(null, "", "no-staff")]);';

const WALK = `  const isStaff: boolean[] = lines.map(() => false);
  const isBracket: boolean[] = lines.map(() => false);
  const isChordRow: boolean[] = lines.map(() => false);
  const decide = (i: number): boolean => {
    if (isStaff[i] || isBracket[i] || isChordRow[i] || lines[i].trim() === "") return false;
    const staffBelow = i + 1 < lines.length && isStaff[i + 1];
    if (staffBelow && lines[i].includes(",") && bracketTokens(lines[i]) !== null) {
      isBracket[i] = true;
      return true;
    }
    if ((staffBelow || (i + 1 < lines.length && isBracket[i + 1])) && readsAsChords(lines[i])) {
      isChordRow[i] = true;
      return true;
    }
    if (isStaffLine(lines[i])) {
      isStaff[i] = true;
      return true;
    }
    const empty = !/[0-9xX]/.test(lines[i]);
    const can = isNotationOnly(lines[i]) || (!empty && readsAsBlockRow(lines[i]) && !readsAsProse(lines[i]));
    if (!can) return false;
    const against = (k: number) =>
      k >= 0 && k < lines.length && isStaff[k] && (!empty || scanRow(k + 1, lines[k]).label === null);
    if (against(i - 1) || against(i + 1)) {
      isStaff[i] = true;
      return true;
    }
    return false;
  };
  for (let changed = true, up = true; changed; up = !up) {
    changed = false;
    for (let n = 0; n < lines.length; n += 1) {
      if (decide(up ? lines.length - 1 - n : n)) changed = true;
    }
  }
`;

const PROSE = `
function readsAsProse(raw: string): boolean {
  const t = raw.trim();
  if (/^[-\\u2014\\u2013|]|[-\\u2014\\u2013|]$/.test(t)) return false;
  if (/^[\\d\\s./:]+$/.test(t)) return true;
  if (tokens(t).every((k) => isChord(k.text))) return true;
  const body = t.replace(/^[A-Ga-g][#b\\u266F\\u266D]{0,2}\\d?\\s+/, "");
  return /(?<![\\p{L}\\p{N}])\\p{L}{2,}(?![\\p{L}\\p{N}])/u.test(body);
}
`;

export default defineConfig({
  cacheDir: path.join(os.tmpdir(), "spec004-candidate-walk"),
  plugins: [
    react(),
    {
      name: "candidate-walk",
      enforce: "pre",
      transform(code, id) {
        if (!id.replace(/\\/g, "/").endsWith("src/lib/tab/parse.ts")) return null;
        const from = code.indexOf(START);
        const to = code.indexOf(END);
        if (from < 0 || to < 0) throw new Error("the classifier has moved, so this no longer applies");
        return code.slice(0, from) + WALK + code.slice(to) + PROSE;
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
