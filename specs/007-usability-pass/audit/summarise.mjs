// Prints what the audit found, per screen. Run after walk.audit.ts: `node specs/007-usability-pass/audit/summarise.mjs`.
// Fret cells and staff columns are reported apart: they are sized on purpose and would drown the rest.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "results");
const files = fs.readdirSync(dir).filter((f) => /\.\d+x\d+\.(dark|light)\.json$/.test(f));
const screens = [...new Set(files.map((f) => f.split(".")[0]))].sort();
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
const uniq = (list) => [...new Set(list)];
const sized = (t) => `${t.name || t.tag} ${t.w}x${t.h}`;

for (const screen of screens) {
  console.log(`\n## ${screen}`);
  for (const size of ["375x667", "390x844"]) {
    const dark = `${screen}.${size}.dark.json`;
    const light = `${screen}.${size}.light.json`;
    if (!files.includes(dark)) continue;
    const d = read(dark);
    const l = files.includes(light) ? read(light) : d;
    const own = d.targets.filter((t) => !t.inFretGrid && !t.isColumn && !t.disabled);
    const small = own.filter((t) => Math.min(t.w, t.h) < 24);
    const under = own.filter((t) => Math.min(t.w, t.h) >= 24 && Math.min(t.w, t.h) < 44);
    const low = (r) => uniq(r.text.filter((t) => t.ratio < 4.5).map((t) => `${t.text.slice(0, 24)} ${t.font}px ${t.ratio}`));
    console.log(`- ${size}: page ${d.pageWidth}x${d.pageHeight}; targets ${own.length}, under24 ${small.length}, 24-44 ${under.length}, topHalf ${own.filter((t) => t.topHalf).length}, beyondFold ${own.filter((t) => t.beyondFold).length}`);
    if (small.length) console.log(`    under24: ${uniq(small.map(sized)).join(" | ")}`);
    if (under.length) console.log(`    24-44: ${uniq(under.map(sized)).slice(0, 24).join(" | ")}`);
    if (d.clipped.length) console.log(`    clipped: ${uniq(d.clipped.map((c) => `${c.text.slice(0, 30)} (${c.kind} +${c.over})`)).slice(0, 10).join(" | ")}`);
    if (d.wrapped.length) console.log(`    wrapped: ${uniq(d.wrapped.map((c) => `${c.text.slice(0, 30)} x${c.lines}`)).join(" | ")}`);
    if (d.inputs.length) console.log(`    inputs: ${d.inputs.map((i) => `${i.name.slice(0, 18)} ${i.font}px bottom ${i.bottom}${i.underKeyboard ? " UNDER-KB" : ""}`).join(" | ")} (kb top ${d.keyboardTop})`);
    if (d.staves.length) console.log(`    staves: ${d.staves.slice(0, 4).map((s) => `${s.client}/${s.scroll}`).join(" ")}`);
    if (d.staffFont) console.log(`    staffFont: ${JSON.stringify(d.staffFont)}`);
    console.log(`    lowContrast dark ${low(d).length}: ${low(d).slice(0, 8).join(" | ")}`);
    console.log(`    lowContrast light ${low(l).length}: ${low(l).slice(0, 8).join(" | ")}`);
  }
}

console.log("\n## budget");
for (const f of fs.readdirSync(dir).filter((x) => x.startsWith("budget-")).sort()) {
  const b = read(f);
  console.log(f, b.kids.map((k) => `${k.cls.split(" ").slice(0, 2).join(" ").slice(0, 26)}=${k.h}`).join("; "));
  console.log("   staff", b.staff, "stableButton", b.stableButton, "latch", b.latch, "grid", b.grid, "fret", b.fretCell);
}
for (const f of ["defects.json", "long-press.json"]) console.log(f, fs.readFileSync(path.join(dir, f), "utf8"));

for (const f of fs.readdirSync(dir).filter((x) => /^(candidate|reading)-.*\.json$/.test(x)).sort()) {
  console.log(f, JSON.stringify(read(f)));
}
if (fs.existsSync(path.join(dir, "refusals.json"))) console.log("refusals.json", fs.readFileSync(path.join(dir, "refusals.json"), "utf8"));
