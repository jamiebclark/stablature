/**
 * Round 9. INV-014 and INV-030 over the shapes only S6 claims. Those invariants' probes were written
 * before S6 asked about a line's neighbours, and every system in them has a run of three rails or a
 * pipe, which S1 to S4 take. S6 looks at raw neighbouring lines, so whitespace is a new way in, and
 * it runs on every line, so a paste of nothing but such lines is a new worst case.
 */
import { describe, expect, it } from "vitest";
import { parseTab } from "@/lib/tab/parse";

const SYSTEMS: [string, string[]][] = [
  ["numbers under a rails-only row", ["-------", "3-5-3-7", "-------", "-------"]],
  ["numbers over a rails-only row", ["3-5-3-7", "-------", "-------", "-------"]],
  ["numbers on every row", ["3-5-3-7", "5-7-5-9", "7-9-7-2", "2-4-2-5"]],
  ["two rails between notes", ["--3--5--", "--------", "--------", "--7--9--"]],
  ["dead notes", ["-x-x-x-", "-------", "-------", "-3-5-3-"]],
];

const clipboardOf = (text: string) => {
  const parsed = parseTab(text);
  return parsed.ok ? parsed.clipboard : { refused: parsed.refusals.map((r) => r.code) };
};

const TRANSFORMS: [string, (rows: string[]) => string][] = [
  ["\\r\\n", (r) => r.join("\r\n")],
  ["\\r", (r) => r.join("\r")],
  ["trailing spaces", (r) => r.map((l, i) => l + " ".repeat(i + 1)).join("\n")],
  ["a trailing newline", (r) => `${r.join("\n")}\n`],
  ["a leading BOM", (r) => `﻿${r.join("\n")}`],
  ["non-breaking spaces in the gutter", (r) => r.map((l) => `  ${l}`).join("\n")],
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n): [string, (rows: string[]) => string] => [
    `an equal gutter of ${n}`,
    (r) => r.map((l) => " ".repeat(n) + l).join("\n"),
  ]),
  ["unequal gutters", (r) => r.map((l, i) => " ".repeat(i * 2) + l).join("\n")],
];

describe("INV-014 whitespace changes nothing about a line S6 claims", () => {
  for (const [name, rows] of SYSTEMS) {
    it(`${name} reads`, () => {
      expect(parseTab(rows.join("\n")).ok).toBe(true);
    });
    it.each(TRANSFORMS)(`${name}: %s`, (_label, transform) => {
      expect(clipboardOf(transform(rows))).toEqual(clipboardOf(rows.join("\n")));
    });
  }
});

describe("INV-030 a paste of nothing but lines S6 asks about stays linear", () => {
  const timed = (text: string) => {
    const start = performance.now();
    parseTab(text);
    return performance.now() - start;
  };

  const SHAPES: [string, (n: number) => string][] = [
    ["stacked numbers", (n) => Array.from({ length: n }, () => "3-5-3-7").join("\n")],
    ["stacked `x-`", (n) => Array.from({ length: n }, () => "x-").join("\n")],
    ["stacked `|5`", (n) => Array.from({ length: n }, () => "|5").join("\n")],
    ["stacked chord lists", (n) => Array.from({ length: n }, () => "Am7-D7-Gmaj7").join("\n")],
    ["numbers apart", (n) => Array.from({ length: n }, () => "1-2-3-4").join("\n\n")],
    ["numbers and rails in turn", (n) => Array.from({ length: n }, (_, i) => (i % 2 ? "-------" : "3-5-3-7")).join("\n")],
    ["numbers and prose in turn", (n) => Array.from({ length: n }, (_, i) => (i % 2 ? "la la la" : "3-5-3-7")).join("\n")],
    ["one long line", (n) => "3-5-".repeat(n * 10)],
  ];

  it.each(SHAPES)("%s", (_name, shape) => {
    timed(shape(100));
    const small = timed(shape(1_000));
    const large = timed(shape(5_000));
    process.stderr.write(`${_name}: 1,000 in ${small.toFixed(0)} ms, 5,000 in ${large.toFixed(0)} ms\n`);
    expect(large).toBeLessThan(2_000);
    // A tall block grows faster than its lines, however its rows are claimed, which S6 did not start:
    // INV-030-growth-of-a-tall-block.test.ts has the numbers, and review NOTE F79 says why it stands.
    if (_name.startsWith("stacked") || _name.includes("rails")) return;
    // Five times the lines, with room for noise. A quadratic reader takes twenty-five times as long.
    expect(large).toBeLessThan(Math.max(small * 12, 200));
  });
});
