/**
 * F21: which files changed line ending against origin/main? Counts CRLF by bytes, because `grep -c $'\r'` under Git
 * Bash gave a different answer on two runs of the same blob. Reports HEAD and the working tree apart, since the
 * runner's commit is what lands and the two can differ.
 *
 *   node specs/006-reading-aids/review-probes/F21-line-endings.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const git = (...args) => execFileSync("git", args, { maxBuffer: 1 << 28 });
const crlf = (bytes) => {
  let lines = 0;
  let cr = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] !== 10) continue;
    lines += 1;
    if (i > 0 && bytes[i - 1] === 13) cr += 1;
  }
  return { lines, cr };
};
const shape = ({ lines, cr }) => (lines === 0 || cr === 0 ? "LF" : cr === lines ? "CRLF" : `mixed ${cr}/${lines}`);

const changed = git("diff", "--name-only", "--diff-filter=M", "origin/main...HEAD").toString().trim().split("\n");
let flips = 0;
for (const file of changed.filter((f) => !f.startsWith("specs/"))) {
  const base = shape(crlf(git("show", `origin/main:${file}`)));
  const head = shape(crlf(git("show", `HEAD:${file}`)));
  const tree = existsSync(file) ? shape(crlf(readFileSync(file))) : "gone";
  const flag = base === head && base === tree ? "" : "  <-- differs";
  if (flag) flips += 1;
  console.log(`${file}: main ${base}, HEAD ${head}, tree ${tree}${flag}`);
}
console.log(`${flips} of ${changed.length} changed files differ`);
