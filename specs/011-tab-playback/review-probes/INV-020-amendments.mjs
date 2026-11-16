// INV-020 without `grep -iF`, which aborts (core dumped) in this machine's Git Bash grep 3.0 whatever the locale, so
// `npm run check:playback-amendments` reports every present decision as MISSING here. Same three checks, in node:
//   node specs/011-tab-playback/review-probes/INV-020-amendments.mjs
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
const read = (p) => readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");
const spec = read("specs/011-tab-playback/spec.md");
const plan = read("specs/011-tab-playback/plan.md");
const s5 = read("specs/005-rhythm-and-tempo/spec.md");
const dec = read("docs/DECISIONS.md");
const missing = [];

const line = s5.split("\n").find((l) => l.includes("Pitched playback of the notes."));
if (!line || !line.includes("Amended by spec 011")) missing.push("spec 005 Out of Scope line lacks 'Amended by spec 011'");

const section = (text, heading) => {
  const out = [];
  let on = false;
  for (const l of text.split("\n")) {
    if (/^## /.test(l)) on = l.startsWith(`## ${heading}`);
    else if (on) out.push(l);
  }
  return out.join("\n");
};
const sub = (text, heading) => {
  const out = [];
  let on = false;
  for (const l of text.split("\n")) {
    if (/^##+ /.test(l)) on = l.startsWith(heading);
    else if (on) out.push(l);
  }
  return out.join("\n");
};
const decisions = section(dec, "011 — decisions").toLowerCase();
const repinned = section(dec, "011 — re-pinned tests");

const leads = (block) => [...block.matchAll(/^\d+\. \*\*([^*]*)\*\*/gm)].map((m) => m[1]);
const specLeads = leads(section(spec, "Decisions made for this spec"));
const planLeads = leads(sub(plan, "### Deviations from the spec"));
if (specLeads.length !== 11) missing.push(`expected 11 spec decisions, parsed ${specLeads.length}`);
if (planLeads.length !== 4) missing.push(`expected 4 plan deviations, parsed ${planLeads.length}`);
for (const l of specLeads) if (!decisions.includes(l.toLowerCase())) missing.push(`spec decision: ${l}`);
for (const l of planLeads) if (!decisions.includes(l.toLowerCase())) missing.push(`plan deviation: ${l}`);

const table = sub(plan, "### Existing tests this changes on purpose").split("**Must pass unedited")[0];
const files = [...table.matchAll(/`([A-Za-z0-9_./-]+\.(?:ts|tsx|json))`/g)].map((m) => m[1]).filter((f) => f.includes("/"));
if (files.length === 0) missing.push("no rows parsed from plan.md's re-pin table");
for (const f of new Set(files)) if (!repinned.includes(path.basename(f))) missing.push(`${f} not named under '011 — re-pinned tests'`);

if (missing.length) {
  for (const m of missing) console.log(`MISSING ${m}`);
  process.exit(1);
}
console.log(`INV-020 held: spec 005 amended, ${specLeads.length} decisions, ${planLeads.length} deviations, ${new Set(files).size} re-pin(s) recorded`);
