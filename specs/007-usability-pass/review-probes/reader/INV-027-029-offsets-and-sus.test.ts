/**
 * Prints, for the reader under test: which offsets `main` and this branch read a joined line at, and how a refused
 * line with a `sus` in it is worded. Compared by eye and by compare.mjs's sibling dump, so it writes rather than asserts.
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { parseTab } from "@/lib/tab/parse";

const WIDE = [
  "e|-5-7-5-7-5-7-5-7-5-7-5-7-5-7-5-7-|",
  "B|---------------------------------|",
  "G|---------------------------------|",
  "D|---------------------------------|",
  "A|---------------------------------|",
  "E|---------------------------------|",
].join("\n");

const shape = (text: string) => {
  const p = parseTab(text);
  if (!p.ok) return `refused ${p.refusals.map((r) => `${r.line}:${r.code}`).join(" ")}`;
  const notes = p.clipboard.annotations?.length ?? 0;
  return `ok ignored=${p.ignored.length} annotations=${notes}`;
};

it("writes the table", () => {
  const out: Record<string, string> = {};
  for (const line of ["Am7-D7", "Am-G7", "Cmaj7-Fmaj7"]) {
    for (const offset of [0, 1, 2, 3, 4, 6, 8, 12, 20]) {
      out[`offset ${offset} ${line}`] = shape(`${" ".repeat(offset)}${line}\n${WIDE}`);
    }
  }
  for (const line of ["D7sus4-G7", "A7sus2-E7", "G7sus4-C7", "A7-D7", "A7 - D7", "A7 D7-G7"]) {
    out[`joined ${line}`] = shape(`${line}\n${WIDE}`);
  }
  writeFileSync(process.env.READER_DUMP!, JSON.stringify(out, null, 1));
});
