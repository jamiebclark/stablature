/**
 * Round 3. INV-008: never is a bad line left out. FR-018: "for every such line, not only the first".
 *
 * Round 2's pairs had two different codes. Here two lines of one system fail the SAME rule, and each
 * check still stops at its first, so a person fixes one line and is refused again.
 */
import { describe, expect, it } from "vitest";
import { parseTab } from "@/lib/tab/parse";

const lines = (text: string) => {
  const r = parseTab(text);
  return r.ok ? "read" : r.refusals.map((x) => `${x.line} ${x.code}`);
};

const CASES: [string, string[], string[]][] = [
  [
    "two rows short",
    ["G|---5---|", "D|---5|", "A|---3|", "E|---3---|", "B|---3---|"],
    ["2 row-length", "3 row-length"],
  ],
  [
    "two rows short by different amounts",
    ["G|---5---|", "D|---5|", "A|---3-|", "E|---3---|", "B|---3---|"],
    ["2 row-length", "3 row-length"],
  ],
  [
    "two rows without the barline",
    ["G|---5---|---|", "D|---5-------|", "A|---3-------|", "E|---3---|---|", "B|---3---|---|"],
    ["2 partial-barline", "3 partial-barline"],
  ],
  [
    "two labels that are no note",
    ["Q|---5---|", "D|---5---|", "W|---3---|", "E|---3---|"],
    ["1 label-unknown", "3 label-unknown"],
  ],
  [
    "repeat labels disagree on two columns",
    ["G|-5x3---7x2-|", "D|-5x4---7x2-|", "A|-5x3---7x5-|", "E|-5x3---7x2-|"],
    ["2 repeat-disagrees", "3 repeat-disagrees"],
  ],
  [
    "cells overlap on two columns",
    ["G|-12--------|", "D|--13-------|", "A|-------11--|", "E|--------12-|"],
    ["2 cell-overlap", "4 cell-overlap"],
  ],
];

describe("INV-008 two lines of one system fail the same rule: both are listed", () => {
  it.each(CASES)("%s", (_name, rows, expected) => {
    expect(lines(rows.join("\n"))).toEqual(expected);
  });
});
