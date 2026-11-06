/**
 * Runs **Joined** and **Stays** x **Pos** x {bass4-e, guitar6} through the reader and writes what it said, so the same
 * matrix can be compared with `main`'s reader (run with READER_ROOT at an extraction of main). See compare.mjs.
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { parseTab } from "@/lib/tab/parse";

const SYSTEMS: Record<string, string> = {
  "bass4-e": ["G|-5-7-|", "D|-----|", "A|-----|", "E|-----|"].join("\n"),
  guitar6: ["e|-5-7-|", "B|-----|", "G|-----|", "D|-----|", "A|-----|", "E|-----|"].join("\n"),
};

const JOINED = ["Am7-D7", "Am7-D7-G", "Cmaj7-Fmaj7", "Dm7-G7-Cmaj7", "F#m7-B7", "Dsus4-A7", "Cadd9-G", "Bbm7-Eb7", "Am-G7"];
const STAYS = [
  "A7-D7", "E5-A5", "C-G7", "A7-D7-E7", "E5-G5-A5", "D-7-G-7", "Am7-b7", "Am7-7", "Am7-5", "Bm7-5", "Am7-D7-", "-Am7-D7",
  "Am7--D7", "G5-7", "E-5-7", "(c) 1999-2004", "1-2-3-4-",
];
const KEEP_CODE = ["Am7 - D7"];

const wide = (system: string) =>
  system
    .split("\n")
    .map((row, i) => (i === 0 ? row.replace("-5-7-", "-5-7-5-7-5-7-5-7-5-7-5-7-") : row.replace("-----", "-".repeat(25))))
    .join("\n");

const POS: Record<string, (line: string, system: string) => { text: string; at: number; bare: string }> = {
  "directly above": (l, s) => ({ text: `${l}\n${s}`, at: 1, bare: s }),
  "directly below": (l, s) => ({ text: `${s}\n${l}`, at: s.split("\n").length + 1, bare: s }),
  "apart above": (l, s) => ({ text: `${l}\n\n${s}`, at: 1, bare: s }),
  "apart below": (l, s) => ({ text: `${s}\n\n${l}`, at: s.split("\n").length + 2, bare: s }),
  "between two systems": (l, s) => ({ text: `${s}\n\n${l}\n\n${s}`, at: s.split("\n").length + 2, bare: `${s}\n\n${s}` }),
  // A chord row must fit over the staff, so an offset needs a staff wider than the line: over a short one, main refuses it.
  "at an offset above": (l, s) => ({ text: `   ${l}\n${wide(s)}`, at: 1, bare: wide(s) }),
};

const brief = (text: string) => {
  const p = parseTab(text);
  if (!p.ok) return { ok: false, refusals: p.refusals.map((r) => ({ line: r.line, code: r.code })) };
  return {
    ok: true,
    ignored: p.ignored,
    columns: p.clipboard.columns.length,
    clipboard: JSON.stringify(p.clipboard),
  };
};

it("dumps the matrix", () => {
  const out: Record<string, unknown> = {};
  for (const [system, block] of Object.entries(SYSTEMS)) {
    for (const [pos, build] of Object.entries(POS)) {
      for (const [set, lines] of [["joined", JOINED], ["stays", STAYS], ["keep", KEEP_CODE]] as const) {
        for (const line of lines) {
          const { text, at, bare } = build(line, block);
          out[`${set}|${system}|${pos}|${line}`] = { at, read: brief(text), bare: brief(bare) };
          // The advice in `chords-joined`: spaces, set apart on a line of its own; or delete the line.
          const spaced = build(`\n${line.replace(/-/g, " ")}\n`, block);
          out[`advice|${system}|${pos}|${line}`] = { spaced: brief(spaced.text).ok, deleted: brief(bare).ok };
        }
      }
    }
  }
  for (const [system, block] of Object.entries(SYSTEMS)) {
    for (const line of ["   Am7 D7", "  Cmaj7  Fmaj7", "     Dm7   G7", "Am7 D7"]) {
      const text = `${line}
${wide(block)}`;
      out[`spaced|${system}|at an offset above|${line}`] = { at: 1, read: brief(text), bare: brief(wide(block)) };
    }
  }
  writeFileSync(process.env.READER_DUMP!, JSON.stringify(out));
});
