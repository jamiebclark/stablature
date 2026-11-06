/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * INV-027, INV-028 and INV-029: the joined-chord reader against `main`. `main-reader-table.json` is main's reader's answer
 * for each stays/keep/spaced case, recorded once (clipboards as a sha1 prefix) so no extraction of `main` is needed.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
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

const dump = () => {
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
  return out;
};

const compare = (work: Record<string, unknown>, main: Record<string, unknown>) => {
const REWORDED = new Set(["A7-D7", "E5-A5", "D-7-G-7", "C-G7", "A7-D7-E7", "E5-G5-A5"]);
const KEEPS = new Set(["G5-7", "E-5-7", "Am7 - D7"]);

const bad: string[] = [];
const tally: Record<string, number> = { joined: 0, offset: 0, stays: 0, keep: 0, advice: 0 };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

for (const [key, w] of Object.entries(work) as [string, any][]) {
  const [set, system, pos, line] = key.split("|");
  const m = main[key] as any;
  if (set === "advice") {
    if (!REWORDED.has(line)) continue;
    tally.advice += 1;
    if (!w.deleted) bad.push(`advice ${key}: deleting the line does not read`);
    if (!w.spaced) bad.push(`advice ${key}: spacing the chords, set apart, does not read`);
    continue;
  }
  if (set === "spaced") {
    // What the plan's offset clause protects: main never reads a hyphen-joined line as a chord row, at any offset.
    tally.offset += 1;
    if (!same(w.read, m.read)) bad.push(`INV-027 spaced chord row ${key}: differs from main`);
    if (!w.read.ok) bad.push(`INV-027 spaced chord row ${key}: refused`);
    continue;
  }
  if (set === "joined") {
    tally.joined += 1;
    if (!w.read.ok) bad.push(`INV-027 ${key}: refused ${JSON.stringify(w.read.refusals)}`);
    else {
      if (w.read.columns !== w.bare.columns) bad.push(`INV-027 ${key}: ${w.read.columns} columns, ${w.bare.columns} without the line`);
      if (!w.read.ignored.some((x: any) => x.line === w.at && x.text.trim() === line)) bad.push(`INV-027 ${key}: not listed at ${w.at}: ${JSON.stringify(w.read.ignored)}`);
      if (w.read.clipboard !== w.bare.clipboard) bad.push(`INV-027 ${key}: the clipboard differs from the staff alone`);
    }
    continue;
  }
  // Stays and the keep-code line.
  tally[set] += 1;
  if (m.read.ok !== w.read.ok) {
    bad.push(`INV-028 ${key}: main ok=${m.read.ok}, work ok=${w.read.ok}`);
    continue;
  }
  if (w.read.ok) {
    if (!same(w.read, m.read)) bad.push(`INV-028 ${key}: reads differently from main`);
    continue;
  }
  const lines = (r: any) => r.refusals.map((x: any) => x.line).join(",");
  if (lines(w.read) !== lines(m.read)) bad.push(`INV-029 ${key}: refused lines ${lines(w.read)}, main ${lines(m.read)}`);
  w.read.refusals.forEach((r: any, i: number) => {
    const was = m.read.refusals[i]?.code;
    if (r.code === was) return;
    if (r.code === "chords-joined" && REWORDED.has(line) && !KEEPS.has(line)) return;
    bad.push(`INV-029 ${key}: code ${r.code}, main ${was}`);
  });
}

  return { bad, tally };
};

const sha = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 12);

it("reads and refuses what main did, and the joined lines read as commentary", () => {
  const table = JSON.parse(readFileSync(path.join(__dirname, "main-reader-table.json"), "utf8"));
  const main = Object.fromEntries(Object.entries(table).map(([k, read]) => [k, { read }]));
  const work = dump() as Record<string, any>;
  // Same reduction as the table's: a clipboard is compared by hash.
  for (const v of Object.values(work))
    for (const side of ["read", "bare"]) if (v[side]?.ok) v[side] = { ...v[side], clipboard: sha(v[side].clipboard) };
  const { bad } = compare(work, main);
  expect(bad).toEqual([]);
});
