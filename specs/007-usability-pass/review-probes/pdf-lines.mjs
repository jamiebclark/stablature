// INV-038, round 3: `node pdf-lines.mjs file.pdf`. Reads where Chromium really placed text in a printed PDF, page by page,
// and reports each staff line against the string labels in the gutter. Reads the content streams directly because no PDF
// renderer is installed here. Text is shown as Skia writes it: `a b c d e f cm`, `... Tm`, `x y Td`, `<hex> Tj`.
// Positions are CSS px from the top left of the page. GUTTER_X is the right edge of the gutter on an A4 page.
import { readFileSync } from "node:fs";
import zlib from "node:zlib";

const GUTTER_X = Number(process.env.GUTTER_X ?? 56);
const buf = readFileSync(process.argv[2]);
const raw = buf.toString("latin1");

const mul = (a, b) => [
  a[0] * b[0] + a[1] * b[2],
  a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2],
  a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4],
  a[4] * b[1] + a[5] * b[3] + b[5],
];

function pageText(stream) {
  const out = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let tm = [1, 0, 0, 1, 0, 0];
  for (const line of stream.split(/\r?\n/)) {
    const t = line.trim();
    if (t === "q") stack.push(ctm);
    else if (t === "Q") ctm = stack.pop() ?? ctm;
    else if (/ cm$/.test(t)) ctm = mul(t.split(/\s+/).slice(0, 6).map(Number), ctm);
    else if (/ Tm$/.test(t)) tm = t.split(/\s+/).slice(0, 6).map(Number);
    else {
      const td = t.match(/^(-?[\d.]+) (-?[\d.]+) Td(?: <([0-9A-F]+)> Tj)?$/);
      const tj = t.match(/^<([0-9A-F]+)> Tj$/);
      if (td) tm = mul([1, 0, 0, 1, Number(td[1]), Number(td[2])], tm);
      const hex = td?.[3] ?? tj?.[1];
      if (hex) {
        const m = mul(tm, ctm);
        out.push({ x: m[4] / 0.75, y: (842.88 - m[5]) / 0.75, hex });
      }
    }
  }
  return out;
}

const pages = [];
const re = /stream\r?\n/g;
for (let m = re.exec(raw); m; m = re.exec(raw)) {
  const start = m.index + m[0].length;
  const end = raw.indexOf("endstream", start);
  try {
    const text = zlib.inflateSync(buf.subarray(start, end)).toString("latin1");
    if (/\bBT\b/.test(text) && / cm\b/.test(text)) pages.push(pageText(text));
  } catch {
    // Not a flate stream.
  }
}

let bad = 0;
let rows = 0;
pages.forEach((items, index) => {
  const labels = [...new Set(items.filter((i) => i.x < GUTTER_X).map((l) => Math.round(l.y)))].sort((a, b) => a - b);
  // All this song's notes sit on one string, so a line has one fret row: the row of many items that are not all one glyph.
  const byRow = new Map();
  for (const f of items.filter((i) => i.x >= GUTTER_X)) {
    const y = Math.round(f.y);
    byRow.set(y, [...(byRow.get(y) ?? []), f.hex]);
  }
  const fretRows = [...byRow].filter(([, hex]) => hex.length > 24 && new Set(hex).size > 1).map(([y]) => y).sort((a, b) => a - b);
  const off = fretRows.map((y) => ({ y, by: Math.min(...labels.map((l) => Math.abs(l - y))) })).filter((r) => r.by > 2);
  console.log(`page ${index + 1}: ${fretRows.length} fret rows, ${off.length} with no label beside them${off.length ? " " + JSON.stringify(off) : ""}`);
  rows += fretRows.length;
  bad += off.length;
});
console.log(bad ? `${bad} of ${rows} fret rows have no label beside them` : `held, ${rows} fret rows`);
process.exitCode = bad ? 1 : 0;
