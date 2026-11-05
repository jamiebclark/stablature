/**
 * Round 9. INV-030 asks that a long paste stays linear. 5,000 stacked lines of `3-5-3-7` took 13
 * times as long as 1,000. This measures the growth and whether S6 is what grows, by printing the
 * same paste as rows with pipes, which S2 takes with no help from S6. A tall block is one system
 * with thousands of rows, and no instrument has that, so the bound is INV-030's own scale.
 */
import { describe, expect, it } from "vitest";
import { parseTab } from "@/lib/tab/parse";

const timed = (text: string) => {
  const start = performance.now();
  parseTab(text);
  return performance.now() - start;
};

const SHAPES: [string, (n: number) => string][] = [
  ["only S6 claims these", (n) => Array.from({ length: n }, () => "3-5-3-7").join("\n")],
  ["S2 claims these", (n) => Array.from({ length: n }, () => "|3-5-3-7|").join("\n")],
  ["S4 claims these", (n) => Array.from({ length: n }, () => "---5---7---").join("\n")],
];

describe("INV-030 a block thousands of rows tall", () => {
  it.each(SHAPES)("%s", (name, shape) => {
    timed(shape(200));
    const times = [1_000, 2_000, 5_000, 10_000, 20_000].map((n) => [n, timed(shape(n))] as const);
    process.stderr.write(`${name}: ${times.map(([n, t]) => `${n} in ${t.toFixed(0)} ms`).join(", ")}\n`);
    // INV-030's own scale: 5,000 stacked lines, as round 4 set it. Round 9 reports the rest.
    expect(times[2][1]).toBeLessThan(2_000);
  }, 60_000);
});
