/**
 * Can the suite tell when T073's fast path goes wrong? Each mutant breaks one thing `pack` or the second counter
 * promises, in a copy, and runs the reading tests. Anything the suite misses is then put to this round's probe.
 *
 *   node specs/006-reading-aids/review-probes/run-mutants-t073.mjs <dir> [text in the mutant's name]
 *
 * `<dir>` is a throwaway tree with a `node_modules`. This copies the working tree's `src/` and vitest config into
 * it and never writes to the repo. KILLED needs a test to have failed: a run that collected no tests, or could not
 * start, is BROKEN and proves nothing.
 */
import { spawnSync } from "node:child_process";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const tree = process.argv[2];
if (!tree) throw new Error("Give the throwaway tree as the first argument");
const root = path.resolve(import.meta.dirname, "../../..");
const probes = path.join(root, "specs/006-reading-aids/review-probes");

cpSync(path.join(root, "src"), path.join(tree, "src"), { recursive: true });
for (const file of ["vitest.config.mts", "vitest.setup.ts", "package.json", "tsconfig.json"]) cpSync(path.join(root, file), path.join(tree, file));

const played = "src/lib/reading/played.ts";
const compare = "src/lib/reading/compare.ts";
const MUTANTS = [
  { name: "pack forgets a technique", file: played, from: `      if (Array.isArray(stored) && stored.length > 0) return null;`, to: `` },
  { name: "pack forgets a duration", file: played, from: `event.durationHint != null || `, to: `` },
  { name: "pack forgets a group", file: played, from: ` || event.tupletId) return null;`, to: `) return null;` },
  { name: "pack forgets a rest", file: played, from: `let key = event.kind === "rest" ? 1 : 0;`, to: `let key = 0;` },
  { name: "pack loses the eight-string cap", file: played, from: `if (strings > 8 || `, to: `if (` },
  { name: "pack's digits overlap, base 37", file: played, from: `key = key * 65 + digit;`, to: `key = key * 37 + digit;` },
  { name: "x shares a digit with fret 36", file: played, from: `if (fret === "x") digit = SIMPLE_X + 1;`, to: `if (fret === "x") digit = 37;` },
  {
    name: "the two tables number from separate counters",
    file: compare,
    from: `      id = count;\r\n      count += 1;\r\n      packed.set(key, id);`,
    to: `      id = packed.size;\r\n      packed.set(key, id);`,
  },
  { name: "a repetition's words carry the chord", file: played, from: `partsOf(this.event, this.shared.strings, this.repetition, this.shared.chords)`, to: `partsOf(this.event, this.shared.strings, 0, this.shared.chords)` },
];

function run(args) {
  const done = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", ...args], { cwd: tree, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const out = `${done.stdout}${done.stderr}`;
  return { failed: /Tests\s+(\d+) failed/.exec(out)?.[1], passed: /Tests\s+(?:\d+ failed \| )?(\d+) passed/.exec(out)?.[1], out };
}

const SUITE = ["src/lib/reading", "src/components/reading", "--exclude", "**/budget.test.ts", "--exclude", "**/t073.probe.test.ts"];
cpSync(path.join(probes, "oracle-776c993"), path.join(tree, "src/lib/reading/__tests__/oracle-776c993"), { recursive: true });
cpSync(path.join(probes, "INV-019-020-022-023-024-t073-results-unchanged.test.ts"), path.join(tree, "src/lib/reading/__tests__/t073.probe.test.ts"));
writeFileSync(
  path.join(tree, "src/lib/reading/__tests__/t073.probe.config.mts"),
  `import config from "../../../../vitest.config.mts";\nexport default { ...config, test: { ...config.test, testTimeout: 300000, include: ["src/lib/reading/__tests__/t073.probe.test.ts"] } };\n`,
);
// The empty-string technique is red on the tree (F27), so only a probe failing past that one counts.
const PROBE = ["--config", "src/lib/reading/__tests__/t073.probe.config.mts", "-t", "T073 pairs: Same|T073 songs|T073 twins|T073 words"];

const control = run(SUITE);
if (control.failed || !control.passed) throw new Error(`The unmutated suite is not green:\n${control.out.slice(-800)}`);
console.log(`control  suite ${control.passed} passed`);
const probeControl = run(PROBE);
if (probeControl.failed || !probeControl.passed) throw new Error(`The unmutated probe is not green:\n${probeControl.out.slice(-800)}`);
console.log(`control  probe ${probeControl.passed} passed`);

let unkilled = 0;
for (const mutant of MUTANTS.filter((m) => m.name.includes(process.argv[3] ?? ""))) {
  const target = path.join(tree, mutant.file);
  const source = readFileSync(target, "utf8");
  const changed = source.replace(mutant.from, mutant.to);
  if (changed === source) {
    console.log(`BROKEN   ${mutant.name}: the mutation matched nothing`);
    unkilled += 1;
    continue;
  }
  writeFileSync(target, changed);
  const suite = run(SUITE);
  if (suite.failed) console.log(`KILLED   ${mutant.name}: suite, ${suite.failed} failed, ${suite.passed ?? 0} passed`);
  else if (!suite.passed) {
    console.log(`BROKEN   ${mutant.name}\n${suite.out.slice(-600)}`);
    unkilled += 1;
  } else {
    const probe = run(PROBE);
    if (probe.failed) console.log(`SURVIVED ${mutant.name}: suite ${suite.passed} passed; probe kills it, ${probe.failed} failed`);
    else {
      console.log(`SURVIVED ${mutant.name}: suite ${suite.passed} passed; probe ${probe.passed ?? "?"} passed`);
      unkilled += 1;
    }
  }
  writeFileSync(target, source);
}
process.exitCode = unkilled === 0 ? 0 : 1;
