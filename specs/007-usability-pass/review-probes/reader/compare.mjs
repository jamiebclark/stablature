// INV-027, INV-028 and INV-029: `node compare.mjs work.json main.json`. Exits 1 and names each line that breaks a rule.
import { readFileSync } from "node:fs";

const [work, main] = process.argv.slice(2, 4).map((f) => JSON.parse(readFileSync(f, "utf8")));
const REWORDED = new Set(["A7-D7", "E5-A5", "D-7-G-7", "C-G7", "A7-D7-E7", "E5-G5-A5"]);
const KEEPS = new Set(["G5-7", "E-5-7", "Am7 - D7"]);

const bad = [];
const tally = { joined: 0, offset: 0, stays: 0, keep: 0, advice: 0 };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

for (const [key, w] of Object.entries(work)) {
  const [set, system, pos, line] = key.split("|");
  const m = main[key];
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
      if (!w.read.ignored.some((x) => x.line === w.at && x.text.trim() === line)) bad.push(`INV-027 ${key}: not listed at ${w.at}: ${JSON.stringify(w.read.ignored)}`);
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
  const lines = (r) => r.refusals.map((x) => x.line).join(",");
  if (lines(w.read) !== lines(m.read)) bad.push(`INV-029 ${key}: refused lines ${lines(w.read)}, main ${lines(m.read)}`);
  w.read.refusals.forEach((r, i) => {
    const was = m.read.refusals[i]?.code;
    if (r.code === was) return;
    if (r.code === "chords-joined" && REWORDED.has(line) && !KEEPS.has(line)) return;
    bad.push(`INV-029 ${key}: code ${r.code}, main ${was}`);
  });
}

console.log(JSON.stringify(tally));
if (bad.length) {
  console.log(`${bad.length} broken:`);
  for (const b of bad.slice(0, 40)) console.log(" ", b);
  process.exit(1);
}
console.log("held");
