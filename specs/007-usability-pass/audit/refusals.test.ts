/**
 * What the reader says today about the lines F75 names, alone and beside a good system. It measures
 * and prints, and asserts only that nothing reads as notes. `vitest.audit.config.mts` runs it.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const tuning = presetById("bass4-e")!;
const rows = ["G|--3--5--|", "D|--3--5--|", "A|--3--5--|", "E|--3--5--|"];
const LINES = [
  "Am7-D7", "Am7-D7-G", "Cmaj7-Fmaj7", "D-7-G-7", "A7-D7", "E5-A5", "Am-G", "A-G", "G5-7", "E-5-7",
  "(c) 1999-2004", "1999-2004", "1-2-3-4-", "1-2-3-4", "Intro: Am7-D7", "x2-x4", "Verse 2", "Am7 - D7",
];

it("prints the reader's answer for each line", () => {
  const out: Record<string, unknown> = {};
  for (const line of LINES) {
    for (const [where, text] of [
      ["above", [line, ...rows].join("\n")],
      ["below", [...rows, line].join("\n")],
      ["gap", [line, "", ...rows].join("\n")],
    ] as const) {
      const read = readTab(text, { tuning, bandTunings: [tuning] as never, songEvents: [], othersOnNull: false } as never);
      out[`${line} | ${where}`] =
        read.kind === "refused"
          ? `REFUSED ${read.refusals.map((r) => `${r.code}: ${r.reason}`).join("; ")}`
          : read.kind === "ready"
            ? `read; ignored ${read.ignored.length}, columns ${read.columns}`
            : read.kind;
      expect(read.kind === "ready" ? read.columns : 2).toBe(2);
    }
  }
  writeFileSync(join(__dirname, "results", "refusals.json"), JSON.stringify(out, null, 1));
});
