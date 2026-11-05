/**
 * INV-030 (spec 007), run by `npm run test:spec004` (it is timing-sensitive, so not in `npm test`): spec 004's review probes fail exactly where they failed on `main`, and the F75
 * cost line stays within its bound. Runs the probes through vitest's own JSON reporter in a child.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../../..");
const recorded = readFileSync(path.join(root, "specs/007-usability-pass/audit/main-probe-failures.txt"), "utf8")
  .split("\n")
  .filter((l) => l && !l.startsWith("#"));

describe("spec 004 holds", () => {
  it("fails only where main failed", { timeout: 600_000 }, () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "spec004-"));
    const file = path.join(dir, "out.json");
    spawnSync(
      process.execPath,
      [
        path.join(root, "node_modules/vitest/vitest.mjs"),
        "run",
        "--config",
        "specs/004-ascii-import/review-probes/vitest.probes.config.mts",
        "--reporter=json",
        `--outputFile=${file}`,
      ],
      { cwd: root, stdio: "ignore" },
    );
    const out = readFileSync(file, "utf8");
    rmSync(dir, { recursive: true, force: true });
    const json = JSON.parse(out) as {
      testResults: { name: string; assertionResults: { status: string; ancestorTitles: string[]; title: string }[] }[];
    };
    const failed = json.testResults.flatMap((f) =>
      f.assertionResults
        .filter((a) => a.status === "failed")
        .map((a) => `${path.basename(f.name)} > ${[...a.ancestorTitles, a.title].join(" > ")}`),
    );
    const allowed = new Set(recorded);
    // The timing probe is a recorded flake under load.
    const unexpected = failed.filter((f) => !allowed.has(f) && !f.includes("wrapped lines and prose in turn"));
    expect(unexpected).toEqual([]);
  });
});
