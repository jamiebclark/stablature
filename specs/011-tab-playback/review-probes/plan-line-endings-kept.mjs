/**
 * Round 2. plan.md Technical Context: "Keep each file's line endings." tasks.md Format: "Keep each file's line endings
 * (`npm run check:line-endings`)". The project guard `scripts/check-line-endings.sh` does the same checks, but its
 * new-file test (`grep -q $'\r'`) never matches in Git Bash's grep on this machine, so it cannot see a CR in a new
 * file here. This reads the bytes in Node.
 *
 * Fails when:
 *   - a tracked file this branch modified has a working-tree ending other than its index ending (`git ls-files --eol`);
 *   - an untracked file this branch added under src/, e2e/ or scripts/ contains a CR.
 *
 *   node specs/011-tab-playback/review-probes/plan-line-endings-kept.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const root = git("rev-parse", "--show-toplevel").trim();
process.chdir(root);

const bad = [];
for (const f of git("diff", "--name-only").split("\n").filter(Boolean)) {
  const [i, w] = git("ls-files", "--eol", "--", f).trim().split(/\s+/);
  const index = i.replace(/^i\//, "");
  const tree = w.replace(/^w\//, "");
  if (tree === "mixed" || (index !== tree && index !== "-text" && index !== "none"))
    bad.push(`changed ending  ${f}  (index ${index}, working tree ${tree})`);
}
for (const f of git("ls-files", "--others", "--exclude-standard", "--", "src", "e2e", "scripts").split("\n").filter(Boolean)) {
  const crs = (readFileSync(f, "latin1").match(/\r/g) ?? []).length;
  if (crs) bad.push(`CR in new file  ${f}  (${crs} CRs)`);
}
for (const line of bad) console.log(line);
console.log(bad.length ? `line endings: CHANGED (${bad.length})` : "line endings: kept");
process.exit(bad.length ? 1 : 0);
