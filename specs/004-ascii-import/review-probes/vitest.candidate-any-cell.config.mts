/**
 * Round 9. A feasibility check, not a fix. Each candidate changes S6 in `decide` in `parse.ts`, in
 * memory, and nothing on disk changes. CANDIDATE picks one, CANDIDATE_SCOPE=all widens the run from
 * the round's new probes to every probe and the reader, write and export suites.
 *
 *   CANDIDATE=token npx vitest run --config specs/004-ascii-import/review-probes/vitest.candidate-any-cell.config.mts
 *
 * - `seeds` puts T087's rule back beside T089's, which is the shape that held before.
 * - `notation` adds to `touches` a line made only of the notation, as S5's part (a) already says.
 * - `token` replaces `touches` with a run of characters holding both a note and a rail or pipe.
 * - `token-x` is `token`, and an `x` beside a letter counts in a run made only of the notation, as
 *   `-xb-` and `-tx-` are. This is the one review F78 recommends.
 */
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname, "../../..");

const TOUCHES = "const touches = /[-—–−|][0-9xX]|[0-9xX][-—–−|]/.test(held);\n";
const CLAIM = "if (isStaffLine(lines[i]) || loose) {\n";

const CANDIDATES: Record<string, [string, string][]> = {
  seeds: [
    [
      CLAIM,
      `const body = (k: number) => lines[k].trim().replace(/^[A-Ga-g][#b♯♭]{0,2}\\d?\\s+/, "");
    const bare = (k: number) => k >= 0 && k < lines.length && isNotationOnly(body(k));
    const seeds =
      bare(i) && /[0-9xX]/.test(body(i)) && (/^-|[-|]$/.test(body(i)) || bare(i - 1) || bare(i + 1));
    if (isStaffLine(lines[i]) || loose || seeds) {
`,
    ],
  ],
  notation: [
    [TOUCHES, "const touches = /[-—–−|][0-9xX]|[0-9xX][-—–−|]/.test(held) || isNotationOnly(lines[i]);\n"],
  ],
  token: [
    [
      TOUCHES,
      `const touches = held.split(/\\s+/).some((k) => /[-—–−|]/.test(k) && /\\d|(?<!\\p{L})[xX](?!\\p{L})/u.test(k));\n`,
    ],
  ],
  "token-x": [
    [
      "    const railed = (k: number) =>\n",
      `    const inRun = (k: string) =>
      /\\d|(?<!\\p{L})[xX](?!\\p{L})/u.test(k) || (isNotationOnly(k) && /[xX]/.test(k));
    const railed = (k: number) =>
`,
    ],
    [TOUCHES, "const touches = held.split(/\\s+/).some((k) => /[-—–−|]/.test(k) && inRun(k));\n"],
    ["      note &&\n      (/\\|", "      (note || touches) &&\n      (/\\|"],
  ],
};

const candidate = process.env.CANDIDATE ?? "";
const all = process.env.CANDIDATE_SCOPE === "all";
const probes = "specs/004-ascii-import/review-probes";

export default defineConfig({
  cacheDir: path.join(os.tmpdir(), "spec004-candidate-any-cell", candidate || "control"),
  plugins: [
    react(),
    {
      name: "candidate-any-cell",
      enforce: "pre",
      transform(code, id) {
        if (!id.replace(/\\/g, "/").endsWith("src/lib/tab/parse.ts") || !candidate) return null;
        let source = code.replace(/\r\n/g, "\n");
        for (const [from, to] of CANDIDATES[candidate]) {
          if (!source.includes(from)) throw new Error("the reader has moved, so this no longer applies");
          source = source.replace(from, to);
        }
        return source;
      },
    },
  ],
  root,
  test: {
    globals: true,
    environment: "node",
    include: all
      ? [
          `${probes}/**/*.test.{ts,tsx}`,
          "src/lib/tab/__tests__/**/*.test.ts",
          "src/lib/local/__tests__/**/*.test.ts",
          "src/lib/export/__tests__/**/*.test.ts",
          "src/components/app/__tests__/**/*.test.tsx",
        ]
      : [
          `${probes}/INV-006-009-every-cell-as-a-row.test.ts`,
          `${probes}/INV-006-every-cell-of-a-system.test.ts`,
          `${probes}/INV-006-009-a-token-holds-note-and-rail.test.ts`,
          `${probes}/INV-010-ordinary-lines-anywhere.test.ts`,
        ],
    setupFiles: ["fake-indexeddb/auto", path.join(root, "vitest.setup.ts")],
    testTimeout: 300_000,
    experimental: { fsModuleCache: false } as object,
  },
  resolve: {
    alias: { "@": path.join(root, "src") },
  },
});
