/**
 * Round 2. INV-008: never is a bad line left out. FR-018: "for every such line, not only the first".
 *
 * Round 1's pairs put the two bad lines in two systems, so a fix could pass them without reading
 * anything of a system whose row failed. Here both bad lines sit on ONE system: every row-level
 * code, crossed with every other kind of line that refuses alone in that system.
 */
import { describe, expect, it } from "vitest";
import { parseTab } from "@/lib/tab/parse";

const G = "G |-5-7-5-7-|";
const D = "D |---------|";
const A = "A |---------|";
const E = "E |---------|";

/** A top row that refuses on its own, and the code it refuses with. */
const BAD_ROWS: [string, string][] = [
  ["bad-character", "G |-5s7-5-7-|"],
  ["run-together", "G |-7b9-5-7-|"],
  ["fret-range", "G |-57-5-7--|"],
  ["decoration-order", "G |-7~b-5-7-|"],
  ["long-dash", "G |-5—7-5-7-|"],
  ["space-in-body", "G |-5 7-5-7-|"],
  ["repeat-sign", "G |:5-7-5-7:|"],
  ["connector-double", "G |-5h/7-5-7|"],
  ["repeat-range", "G |-7x0-5-7-|"],
];

/**
 * A second bad line on the same system: rows it replaces, or a line above the staff. `topLine` marks
 * a code that names the system's first row, so it shares a line with the bad top row and one
 * refusal per line (reader.md section 11) lists only one of them.
 */
interface Second {
  name: string;
  rows?: Partial<Record<1 | 2 | 3, string>>;
  above?: string;
  topLine?: boolean;
}

const SECONDS: Second[] = [
  { name: "a row of another length", rows: { 2: "A |-------|" } },
  { name: "a label that is no note", rows: { 3: "T |---------|" } },
  { name: "a row with no label", rows: { 2: "|---------|" }, topLine: true },
  { name: "a barline on one row", rows: { 2: "A |----|----|" } },
  { name: "cells that overlap", rows: { 1: "D |---12----|", 2: "A |----34---|" } },
  { name: "repeat labels that disagree", rows: { 1: "D |-7x3-----|", 2: "A |-5x4-----|" } },
  { name: "a dangling connector", rows: { 2: "A |-5-7h----|" } },
  { name: "a bracket numbered 1", above: "    ,-1-," },
  { name: "a bracket numbered 17", above: "    ,-17-," },
  { name: "a chord over the limit", above: `    C${"add9".repeat(50)}b` },
];

function assemble(badTop: string, second: Second) {
  const rows = [badTop, second.rows?.[1] ?? D, second.rows?.[2] ?? A, second.rows?.[3] ?? E];
  return second.above ? [second.above, ...rows] : rows;
}

describe("control: every line here refuses alone, so a pair below is two bad lines", () => {
  it.each(BAD_ROWS)("%s", (code, bad) => {
    const parsed = parseTab([bad, D, A, E].join("\n"));
    expect(!parsed.ok && parsed.refusals.map((r) => r.code)).toEqual([code]);
  });
  it.each(SECONDS.map((s) => [s.name, s] as const))("%s", (_name, second) => {
    expect(parseTab(assemble(G, second).join("\n")).ok).toBe(false);
  });
});

describe("INV-008 both bad lines of one system are listed", () => {
  for (const [firstCode, bad] of BAD_ROWS) {
    for (const second of SECONDS) {
      it(`${firstCode} with ${second.name}`, () => {
        const lines = assemble(bad, second);
        const parsed = parseTab(lines.join("\n"));
        expect(parsed.ok).toBe(false);
        if (parsed.ok) return;
        const listed = parsed.refusals.map((r) => r.line);
        expect(listed).toContain(lines.indexOf(bad) + 1);
        expect(
          listed.length,
          JSON.stringify(parsed.refusals.map((r) => [r.line, r.code])),
        ).toBeGreaterThanOrEqual(second.topLine ? 1 : 2);
      });
    }
  }
});

describe("INV-008 two system-level problems on one system are both listed", () => {
  const pairs: [string, string[]][] = [
    ["a short row and a bad bracket", ["    ,-1-,", G, D, "A |-----|", E]],
    ["a short row and a long chord", [`    C${"add9".repeat(50)}b`, G, D, "A |-----|", E]],
    ["a bad label and a bad bracket", ["    ,-1-,", G, D, A, "T |---------|"]],
    ["a partial barline and a bad bracket", ["    ,-1-,", G, D, "A |----|----|", E]],
  ];
  it.each(pairs)("%s", (_name, lines) => {
    const parsed = parseTab(lines.join("\n"));
    expect(!parsed.ok && parsed.refusals.length).toBe(2);
  });
});
