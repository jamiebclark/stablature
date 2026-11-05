/**
 * Can the tests adopted for Phase 9 fail? Each mutant undoes one repair, in a copy, and runs the test that guards it.
 *
 *   node specs/006-reading-aids/review-probes/run-mutants.mjs <dir>
 *
 * `<dir>` is a throwaway tree with a real `node_modules`. This copies the working tree's `src/` and vitest config
 * into it and never writes to the repo. KILLED needs a test to have failed: a run that collected no tests, or
 * could not start, is BROKEN and proves nothing.
 */
import { spawnSync } from "node:child_process";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const tree = process.argv[2];
if (!tree) throw new Error("Give the throwaway tree as the first argument");
const root = path.resolve(import.meta.dirname, "../../..");

cpSync(path.join(root, "src"), path.join(tree, "src"), { recursive: true });
for (const file of ["vitest.config.mts", "vitest.setup.ts"]) cpSync(path.join(root, file), path.join(tree, file));

const MUTANTS = [
  {
    name: "a pull lands one table at a time again (T068)",
    file: "src/lib/sync/client.ts",
    from: `  await database.transaction("rw", batches.map(({ table }) => database[table]), async () => {
    for (const { table, parsed } of batches) {
      for (const remote of parsed) {`,
    to: `  for (const { table, parsed } of batches) {
    await database.transaction("rw", [database[table]], async () => {
      for (const remote of parsed) {`,
    also: [
      [
        `        applied += 1;
      }
    }
  });

  return applied;`,
        `        applied += 1;
      }
    });
  }

  return applied;`,
      ],
    ],
    test: "src/lib/reading/__tests__/snapshot.test.ts",
  },
  {
    name: "the song is read outside one transaction (T011)",
    file: "src/lib/local/queries.ts",
    from: `return database.transaction("r", [database.parts, database.events, database.annotations], async () => {`,
    to: `return (async (run: () => Promise<SongContent>) => run())(async () => {`,
    test: "src/lib/reading/__tests__/snapshot.test.ts",
  },
  {
    name: "no store no longer keeps the choice for the visit (T071)",
    file: "src/lib/reading/view.ts",
    from: `unwritten = target === null;`,
    to: `unwritten = false;`,
    test: "src/lib/reading/__tests__/view.test.ts",
  },
  {
    name: "a first subscribe never re-reads storage (T064)",
    file: "src/lib/reading/view.ts",
    from: `if (!unwritten && current !== null) {`,
    to: `if (false as boolean) {`,
    test: "src/lib/reading/__tests__/view.test.ts",
  },
  {
    name: "the slide no longer runs (T058, T072)",
    file: "src/lib/reading/compare.ts",
    from: `const matches = settleEdits(aligned.matches, parent, variant);`,
    to: `const matches = aligned.matches;`,
    test: "src/lib/reading/__tests__/compare-oracle.test.ts",
  },
  {
    name: "the song is read outside one transaction, against this round's probe",
    file: "src/lib/local/queries.ts",
    from: `return database.transaction("r", [database.parts, database.events, database.annotations], async () => {`,
    to: `return (async (run: () => Promise<SongContent>) => run())(async () => {`,
    test: "src/lib/reading/__tests__/one-read.probe.test.ts",
    copy: ["specs/006-reading-aids/review-probes/INV-015-one-read-one-snapshot.test.ts", "src/lib/reading/__tests__/one-read.probe.test.ts"],
  },
];

let survived = 0;
for (const mutant of MUTANTS) {
  const target = path.join(tree, mutant.file);
  const source = readFileSync(target, "utf8");
  let changed = source.replace(mutant.from, mutant.to);
  for (const [from, to] of mutant.also ?? []) changed = changed.replace(from, to);
  if (changed === source) {
    console.log(`BROKEN   ${mutant.name}: the mutation matched nothing`);
    survived += 1;
    continue;
  }
  writeFileSync(target, changed);
  if (mutant.copy) cpSync(path.join(root, mutant.copy[0]), path.join(tree, mutant.copy[1]));
  const run = spawnSync("npx", ["vitest", "run", mutant.test], { cwd: tree, encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "pipe"] });
  writeFileSync(target, source);
  const out = `${run.stdout}${run.stderr}`;
  const failed = /Tests\s+(\d+) failed/.exec(out)?.[1];
  const passed = /Tests\s+(?:\d+ failed \| )?(\d+) passed/.exec(out)?.[1];
  if (failed) console.log(`KILLED   ${mutant.name}: ${failed} failed, ${passed ?? 0} passed`);
  else if (passed) {
    console.log(`SURVIVED ${mutant.name}: ${passed} passed`);
    survived += 1;
  } else {
    console.log(`BROKEN   ${mutant.name}\n${out.slice(-600)}`);
    survived += 1;
  }
}
process.exitCode = survived === 0 ? 0 : 1;
