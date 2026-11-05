/**
 * Round 7. Round 6's ledger counted digits on the top row, over `0 5 - | x h`. Its own review named
 * the edges: no decorations, no other connector, no lower row, and a count cannot see a note that
 * changed or moved. This asks the stronger question through the real export. For any paste that
 * reads, redraw it at the density it was read in. With labels, rails and pipes taken out, every row
 * must hold exactly the characters that were pasted on that row, in order, so nothing was lost,
 * gained, moved or swapped. It needs no second reader, only the export, which is the spec's own
 * definition of the inverse.
 *
 * Two sweeps. Every string over the whole cell alphabet, on every path a row can open on, on the top
 * and the bottom row. Then every single-character edit of real wild pastes, the damage a phone or a
 * copy makes, across every row at once. A row dropped to commentary is the same defect, so a line
 * the reader listed as ignored must not hold a note and a rail (INV-009).
 */
import { describe, expect, it } from "vitest";
import { draftPart } from "@/lib/local/clipboard";
import { toAscii } from "@/lib/tab/ascii";
import { parseTab, type ParsedTab } from "@/lib/tab/parse";
import { presetById, type Tuning } from "@/lib/tunings";

type Read = Extract<ParsedTab, { ok: true }>;

const PRESET: Record<number, string> = { 4: "bass4-e", 5: "bass5-b", 6: "guitar6-e" };

/** A row with its label, gutter, rails and pipes taken out, and the three case allowances folded. */
function held(line: string): string {
  const t = line.trim();
  const body = /^[A-Za-z0-9#♯♭]{1,4}\s*\|/.test(t)
    ? t.replace(/^[A-Za-z0-9#♯♭]{1,4}\s*\|/, "")
    : t.replace(/^[A-Ga-g][#b♯♭]{0,2}\d?\s*(?=-)/, "");
  // A repeat label says nothing with its own leading zeros: `5x05` is five passes (NOTE in review.md).
  return body
    .replace(/(?<=[\dxX)>b~m])x0+(?=\d)/g, "x")
    .replace(/[-|\s]/g, "")
    .replace(/H/g, "h")
    .replace(/P/g, "p")
    .replace(/X/g, "x");
}

/** A line of only the notation that opens or closes on a rail or pipe: no commentary looks so. */
const plainlyARow = (line: string) =>
  /^[-|\d xXhHpP/\~<>()btm]+$/.test(line.trim()) && /^-|[-|]$/.test(line.trim()) && /[\dxX]/.test(line);

/** The rows the export draws for a reading, as held text. */
function redrawn(read: Read, tuning: Tuning): string[] {
  const draft = draftPart(read.clipboard);
  const text = toAscii({
    events: draft.events,
    annotations: draft.annotations,
    tuning,
    density: read.density,
  });
  const lines = text.split("\n");
  return lines.slice(lines.length - read.rows.length).map(held);
}

/** Lines of a paste that the reader took as staff rows, blocks in order, each block one system. */
function blocks(text: string, read: Read): string[][] {
  const ignored = new Set(read.ignored.map((n) => n.line));
  const out: string[][] = [];
  let open = false;
  text.split(/\r\n|\r|\n/).forEach((line, index) => {
    if (line.trim() === "" || ignored.has(index + 1)) {
      open = false;
      return;
    }
    if (!open) out.push([]);
    open = true;
    out[out.length - 1].push(line);
  });
  return out;
}

function pasted(text: string, read: Read): string[] | null {
  const rows = read.rows.length;
  const out: string[] = Array.from({ length: rows }, () => "");
  for (const block of blocks(text, read)) {
    if (block.length < rows) return null;
    block.slice(block.length - rows).forEach((line, r) => (out[r] += held(line)));
  }
  return out;
}

function* strings(alphabet: readonly string[], length: number): Generator<string> {
  if (length === 0) {
    yield "";
    return;
  }
  for (const head of strings(alphabet, length - 1)) for (const c of alphabet) yield head + c;
}

const PATHS: [string, (label: string, body: string) => string][] = [
  ["no label, no pipe", (_l, s) => s],
  ["a label, no pipe", (l, s) => `${l}${s}`],
  ["a label and a pipe", (l, s) => `${l}|${s}|`],
  ["a label, a space and a pipe", (l, s) => `${l} |${s}|`],
  ["a pipe, no label", (_l, s) => `|${s}|`],
];

const ALPHABET = ["0", "5", "-", "|", "x", "X", "h", "P", "/", "\\", "t", "(", ")", "<", ">", "b", "~", "m"];
const LONGEST = Number(process.env.LEDGER_LONGEST ?? 4);
const report = (line: string) => process.stderr.write(`${line}
`);

describe("INV-006 what is pasted on a row is what the export draws on it", () => {
  const tuning = presetById("bass4-e")!;
  const names = ["G", "D", "A", "E"];

  for (const position of [0, 3]) {
    it.each(PATHS)(`row ${position + 1}: %s`, (name, row) => {
      const wrong: string[] = [];
      let read = 0;
      for (let length = 1; length <= LONGEST; length += 1) {
        const rails = "-".repeat(length);
        for (const body of strings(ALPHABET, length)) {
          // A digit before a pipe is a label by spec.md line 105, so it was never a note.
          if (/^\d\|/.test(body)) continue;
          const text = names.map((n, i) => row(n, i === position ? body : rails)).join("\n");
          const parsed = parseTab(text);
          if (!parsed.ok) continue;
          read += 1;
          const want = held(row(names[position], body));
          const got = redrawn(parsed, tuning)[position];
          if (got !== want) wrong.push(`${row(names[position], body)} => ${got}`);
        }
      }
      report(
        `row ${position + 1}, ${name}: ${read} read, ${wrong.length} differ: ${wrong.slice(0, 16).join("   ")}`,
      );
      expect(read).toBeGreaterThan(100);
      expect(wrong.slice(0, 40)).toEqual([]);
    });
  }
});

const PASTES: [string, string][] = [
  [
    "labels flush on pipes, two systems and a lyric",
    [
      "G|---5---7---|---5---|",
      "D|---5---7---|---5---|",
      "A|-3---5-----|-3-----|",
      "E|-----------|-------|",
      "here is a lyric",
      "G|---7h9-----|---5~--|",
      "D|-----------|-------|",
      "A|-0---------|---(3)-|",
      "E|---x-------|-------|",
    ].join("\n"),
  ],
  [
    "no labels, no pipes",
    [
      "----5---7----",
      "----5---7----",
      "--3---5------",
      "-------------",
      "",
      "----5---7----",
      "----5---7----",
      "--3---5------",
      "-------------",
    ].join("\n"),
  ],
  ["note names and rails", ["G---5---7---", "D---5---7---", "A-3---5-----", "E-----------"].join("\n")],
  ["note names, one rail, dense", ["G-5-7-5-7-", "D-5-7-5-7-", "A-3-5-3-5-", "E-3-5-3-5-"].join("\n")],
  ["the app's own shape", ["G |-5-7-|-12-|", "D |-5-7-|----|", "A |-3-5-|-10-|", "E |-----|----|"].join("\n")],
  ["compact", ["G |-7x8-5-|", "D |-----5-|", "A |-7x8---|", "E |-------|"].join("\n")],
  [
    "two-digit cells aligned either end",
    ["G|--12---10--|", "D|---5---5---|", "A|-----------|", "E|-----------|"].join("\n"),
  ],
  [
    "six strings",
    ["e|--0h2p0--|", "B|--1------|", "G|---------|", "D|---------|", "A|---------|", "E|---------|"].join("\n"),
  ],
];

const EDITS = ["-", "|", "0", "5", "x", "h", " ", "?", "—", "E", ":", "(", "\n"];

function* damaged(text: string): Generator<string> {
  for (let i = 0; i <= text.length; i += 1) {
    if (i < text.length) {
      yield text.slice(0, i) + text.slice(i + 1);
      if (i + 1 < text.length) yield text.slice(0, i) + text[i + 1] + text[i] + text.slice(i + 2);
      for (const c of EDITS) if (c !== text[i]) yield text.slice(0, i) + c + text.slice(i + 1);
    }
    for (const c of EDITS) yield text.slice(0, i) + c + text.slice(i);
  }
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    yield [...lines.slice(0, i), ...lines.slice(i + 1)].join("\n");
    yield [...lines.slice(0, i + 1), lines[i], ...lines.slice(i + 1)].join("\n");
    yield [...lines.slice(0, i), "", ...lines.slice(i + 1)].join("\n");
    if (i + 1 < lines.length) {
      yield [...lines.slice(0, i), lines[i + 1], lines[i], ...lines.slice(i + 2)].join("\n");
    }
  }
}

/** A seeded walk, so a failure here is the same failure next round. */
function* twice(text: string, count: number): Generator<string> {
  let state = 20261104;
  const next = (n: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % n;
  };
  const edit = (t: string) => {
    const at = next(t.length + 1);
    const c = EDITS[next(EDITS.length)];
    const kind = next(3);
    if (kind === 0) return t.slice(0, at) + t.slice(at + 1);
    if (kind === 1) return t.slice(0, at) + c + t.slice(at + 1);
    return t.slice(0, at) + c + t.slice(at);
  };
  for (let k = 0; k < count; k += 1) yield edit(edit(text));
}

const TWICE = Number(process.env.LEDGER_TWICE ?? 20000);

describe("INV-006 two edits at once", () => {
  it.each(PASTES)("%s", (name, text) => {
    const wrong: string[] = [];
    const dropped = new Set<string>();
    let read = 0;
    for (const edit of twice(text, TWICE)) {
      const parsed = parseTab(edit);
      if (!parsed.ok) continue;
      read += 1;
      for (const note of parsed.ignored) {
        if (plainlyARow(note.text)) dropped.add(note.text);
      }
      const preset = presetById(PRESET[parsed.rows.length] ?? "");
      if (!preset) continue;
      const want = pasted(edit, parsed);
      const got = redrawn(parsed, preset);
      if (want === null || JSON.stringify(want) !== JSON.stringify(got)) {
        wrong.push(`${JSON.stringify(edit)}\n   pasted ${JSON.stringify(want)}\n   drawn  ${JSON.stringify(got)}`);
      }
    }
    report(
      `${name}: ${read} read of ${TWICE}, ${wrong.length} differ, ${dropped.size} lines dropped\n${wrong.slice(0, 8).join("\n")}\n${[...dropped].slice(0, 24).join("   ")}`,
    );
    expect(read).toBeGreaterThan(0);
    expect(wrong.slice(0, 20)).toEqual([]);
    expect([...dropped].slice(0, 20)).toEqual([]);
  });
});

describe("INV-006 INV-009 no damage to a paste costs a note silently", () => {
  it.each(PASTES)("%s", (name, text) => {
    expect(parseTab(text).ok).toBe(true);
    const wrong: string[] = [];
    const dropped: string[] = [];
    let read = 0;
    let tried = 0;
    const seen = new Set<string>();
    for (const edit of damaged(text)) {
      if (seen.has(edit)) continue;
      seen.add(edit);
      tried += 1;
      const parsed = parseTab(edit);
      if (!parsed.ok) continue;
      read += 1;
      for (const note of parsed.ignored) {
        if (plainlyARow(note.text)) dropped.push(JSON.stringify(edit));
      }
      const preset = presetById(PRESET[parsed.rows.length] ?? "");
      if (!preset) continue;
      const want = pasted(edit, parsed);
      const got = redrawn(parsed, preset);
      if (want === null || JSON.stringify(want) !== JSON.stringify(got)) {
        wrong.push(`${JSON.stringify(edit)}\n   pasted ${JSON.stringify(want)}\n   drawn  ${JSON.stringify(got)}`);
      }
    }
    report(
      `${name}: ${tried} edits, ${read} read, ${wrong.length} differ, ${dropped.length} dropped\n${wrong.slice(0, 12).join("\n")}\n${dropped.slice(0, 12).join("\n")}`,
    );
    expect(read).toBeGreaterThan(0);
    expect(wrong.slice(0, 20)).toEqual([]);
    expect(dropped.slice(0, 20)).toEqual([]);
  });
});
