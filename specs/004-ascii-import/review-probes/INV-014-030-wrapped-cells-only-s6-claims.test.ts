/**
 * Round 10. INV-014-030-lines-only-s6-claims.test.ts was written against T089's rule, so every
 * system in it holds a bare digit. T091 now asks of a run of characters split on whitespace, and it
 * has a second path, `isNotationOnly` on each run, for an `x` beside a letter. Whitespace is how a
 * line is split into runs, so these are the systems that depend on it, and a line of many runs is
 * the new worst case for the cost of that split.
 */
import { describe, expect, it } from "vitest";
import { parseTab } from "@/lib/tab/parse";

const RAILS = "------------";

const SYSTEMS: [string, string[]][] = [
  ["ghost notes", ["--(5)--(7)--", RAILS, RAILS, RAILS]],
  ["harmonics", ["--<5>--<7>--", RAILS, RAILS, RAILS]],
  ["tapped and bent", ["--t5b--t7b--", RAILS, RAILS, RAILS]],
  ["ghost notes under a rails-only row", [RAILS, "--(5)--(7)--", RAILS, RAILS]],
  ["a dead note beside a letter", ["-xb-xb-xb-", "----------", "----------", "----------"]],
  ["a tapped dead note", ["-tx-tx-tx-", "----------", "----------", "----------"]],
  ["every note row wrapped", ["--(5)--(7)--", "--<5>--<7>--", "--t5b--t7b--", "--(x)--(x)--"]],
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

describe("INV-014 whitespace changes nothing about a wrapped cell S6 claims", () => {
  for (const [name, rows] of SYSTEMS) {
    it(`${name} reads`, () => {
      expect(parseTab(rows.join("\n")).ok).toBe(true);
    });
    it.each(TRANSFORMS)(`${name}: %s`, (_label, transform) => {
      expect(clipboardOf(transform(rows))).toEqual(clipboardOf(rows.join("\n")));
    });
  }
});

describe("INV-030 a line of many runs stays linear", () => {
  const timed = (text: string) => {
    const start = performance.now();
    parseTab(text);
    return performance.now() - start;
  };

  const SHAPES: [string, (n: number) => string][] = [
    ["many wrapped runs on one line", (n) => "(5)- ".repeat(n * 10)],
    ["many runs only the notation test asks about", (n) => "-tx- ".repeat(n * 10)],
    ["many runs with no note", (n) => "-b- ".repeat(n * 10)],
    ["wrapped lines apart", (n) => Array.from({ length: n }, () => "--(5)--(7)--").join("\n\n")],
    ["wrapped lines and prose in turn", (n) => Array.from({ length: n }, (_, i) => (i % 2 ? "la la la" : "--(5)--(7)--")).join("\n")],
  ];

  it.each(SHAPES)("%s", (name, shape) => {
    timed(shape(100));
    const small = timed(shape(1_000));
    const large = timed(shape(5_000));
    process.stderr.write(`${name}: 1,000 in ${small.toFixed(0)} ms, 5,000 in ${large.toFixed(0)} ms\n`);
    expect(large).toBeLessThan(2_000);
    expect(large).toBeLessThan(Math.max(small, 5) * 12);
  });
});
