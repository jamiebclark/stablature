/**
 * INV-005 asks whether the backbone can fail. This runs the project's own round-trip suite against
 * a reader broken in one way, chosen by MUTANT. The break is an in-memory transform of parse.ts:
 * nothing on disk changes. A mutant the suite does not kill is a class of defect it cannot see.
 *
 *   MUTANT=chords-lost npx vitest run --config scripts/backbone/vitest.mutants.config.mts
 */
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname, "../..");

const MUTANTS: Record<string, [string, string]> = {
  // Every chord row becomes commentary, so every chord in a fixture is lost.
  "chords-lost": ['symbol === "N.C." || parseChord(symbol) !== null', "false"],
  // FR-005: identical neighbours never merge, so `-7-7-7-7-` stays four columns.
  "no-merge": ["columnKey(column) === columnKey(previous)", "false"],
  // FR-008: a group stops storing its kind.
  "no-group-kind": ['groupKind = tupletCount === null ? "plain" : "tuplet";', "groupKind = null;"],
  // A control: a mutant any honest suite must kill, so a survivor above means something.
  "frets-off-by-one": ["fret: coreText === \"x\" ? \"x\" : Number(coreText),", "fret: coreText === \"x\" ? \"x\" : Number(coreText) + 1,"],
};

const mutant = process.env.MUTANT ?? "";

export default defineConfig({
  // One cache per mutant, wiped by the script: a shared cache serves the last mutant to every run.
  cacheDir: path.join(os.tmpdir(), "spec004-mutants", mutant || "control"),
  plugins: [
    react(),
    {
      name: "mutate-parse",
      enforce: "pre",
      transform(code, id) {
        if (!id.replace(/\\/g, "/").endsWith("src/lib/tab/parse.ts") || !mutant) return null;
        const [from, to] = MUTANTS[mutant];
        if (!code.includes(from)) throw new Error(`mutant ${mutant} no longer applies`);
        return code.replace(from, to);
      },
    },
  ],
  root,
  test: {
    globals: true,
    environment: "node",
    include: ["src/lib/tab/__tests__/round-trip.test.ts"],
    setupFiles: [path.join(root, "vitest.setup.ts")],
    testTimeout: 300_000,
    // Not in the type yet, and needed: a shared module cache served one mutant to all of them.
    experimental: { fsModuleCache: false } as object,
  },
  resolve: {
    alias: { "@": path.join(root, "src") },
  },
});
