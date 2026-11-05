/**
 * Round 6. INV-006 by ledger. Five rounds asked which lines are rows. This asks the other half: of a
 * line that is a row and reads, does every note on it reach the clipboard? Every string over the
 * notation's alphabet up to six characters, on each path a row can open on, sits on the top row of
 * a block whose other rows are rails. Each `ready` reading must store every digit, `x` and connector
 * the row holds. A repeat label is read, not stored as a note, so it is taken out first.
 *
 * It counts characters, not meaning, so it needs no second reader. `G5-7-` holds two digits and
 * `00` holds two, and a reading that keeps one of them has lost a note the person typed.
 */
import { describe, expect, it } from "vitest";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const ALPHABET = ["0", "5", "-", "|", "x", "h"];
const LONGEST = 6;

const PATHS: [string, (body: string) => string, (rails: string, label: string) => string][] = [
  ["no label, no pipe", (s) => s, (r) => r],
  ["a label, no pipe", (s) => `G${s}`, (r, l) => `${l}${r}`],
  ["a label and a pipe", (s) => `G|${s}|`, (r, l) => `${l}|${r}|`],
  ["a label, a space and a pipe", (s) => `G |${s}|`, (r, l) => `${l} |${r}|`],
  ["a pipe, no label", (s) => `|${s}|`, (r) => `|${r}|`],
];

const context = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };

function* strings(length: number): Generator<string> {
  if (length === 0) {
    yield "";
    return;
  }
  for (const head of strings(length - 1)) for (const c of ALPHABET) yield head + c;
}

/** What the row holds: digits, dead notes and connectors, with any repeat label taken out. */
function ledger(body: string) {
  const notes = body.replace(/(?<=[\dx)>b~m])x\d+/g, "");
  return {
    digits: (notes.match(/\d/g) ?? []).length,
    dead: (notes.match(/x/g) ?? []).length,
    connectors: (notes.match(/h/g) ?? []).length,
  };
}

/** What the top string holds, each merged pass counted as the column it was drawn from. */
function stored(reading: Extract<ReturnType<typeof readTab>, { kind: "ready" }>) {
  const out = { digits: 0, dead: 0, connectors: 0 };
  for (const column of reading.clipboard.columns) {
    const passes = reading.density === "compact" ? 1 : column.repeat;
    const fret = column.frets["0"];
    if (fret === undefined) continue;
    if (fret === "x") out.dead += passes;
    else out.digits += String(fret).length * passes;
    out.connectors += (column.techniques["0"] ?? []).filter((t) => t === "hammer_on").length * passes;
  }
  return out;
}

describe("INV-006 every note on a row that reads is stored", () => {
  it.each(PATHS)("%s", (_name, top, other) => {
    const lost: string[] = [];
    let read = 0;
    for (let length = 1; length <= LONGEST; length += 1) {
      for (const body of strings(length)) {
        // A digit before a pipe is a label by spec.md line 105, so it was never a note.
        if (/^\d\|/.test(body)) continue;
        const rails = "-".repeat(length);
        const text = [top(body), other(rails, "D"), other(rails, "A"), other(rails, "E")].join("\n");
        const reading = readTab(text, context);
        if (reading.kind !== "ready") continue;
        read += 1;
        const written = ledger(body);
        const kept = stored(reading);
        if (JSON.stringify(written) !== JSON.stringify(kept)) lost.push(top(body));
      }
    }
    const others = lost.filter((l) => !/(?<!\d)0\d/.test(l) && !/^G\d/.test(l));
    console.log(`${_name}: ${read} read, ${lost.length} lost a note, ${others.length} of them neither F63 nor F64: ${others.slice(0, 12).join("  ")}`);
    expect(read).toBeGreaterThan(100);
    expect(lost.slice(0, 40)).toEqual([]);
  });
});
