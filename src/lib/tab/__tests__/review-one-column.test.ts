/**
 * Round 4. INV-008: never is a bad line left out. FR-018: "for every such line, not only the first".
 *
 * T075 made `buildColumns` carry on past a failed column, so two columns each name a line. Inside one
 * column it still stops: `flush` returns at the first bad pair, so a third row of that column, and a
 * second bad row of the same rule, is not named until the first is fixed.
 *
 * Which of two disagreeing rows counts as the bad one is the reader's to choose, so these assert the
 * count of rows named, not which they are.
 */
import { describe, expect, it } from "vitest";
import { parseTab } from "@/lib/tab/parse";

const named = (rows: string[], code: string) => {
  const r = parseTab(rows.join("\n"));
  if (r.ok) return "read";
  return r.refusals.filter((x) => x.code === code).length;
};

describe("INV-008 several rows of one column fail one rule: each is listed", () => {
  it("three repeat labels disagree, so at least two rows are named", () => {
    const rows = ["G|-5x3-|", "D|-5x4-|", "A|-5x5-|", "E|-5x3-|"];
    expect(named(rows, "repeat-disagrees")).toBeGreaterThanOrEqual(2);
  });
  it("three repeat labels disagree on two columns", () => {
    const rows = ["G|-5x3---7x2-|", "D|-5x4---7x3-|", "A|-5x5---7x4-|", "E|-5x3---7x2-|"];
    expect(named(rows, "repeat-disagrees")).toBeGreaterThanOrEqual(2);
  });
  it("four different labels, so at least three rows are named", () => {
    const rows = ["G|-5x2-|", "D|-5x3-|", "A|-5x4-|", "E|-5x5-|"];
    expect(named(rows, "repeat-disagrees")).toBeGreaterThanOrEqual(3);
  });
  it("a chain of overlaps across three rows", () => {
    const rows = ["G|-12----|", "D|--13---|", "A|---14--|", "E|-------|"];
    expect(named(rows, "cell-overlap")).toBeGreaterThanOrEqual(2);
  });
  it("a chain of overlaps across four rows", () => {
    const rows = ["G|-12-----|", "D|--13----|", "A|---14---|", "E|----15--|"];
    expect(named(rows, "cell-overlap")).toBeGreaterThanOrEqual(3);
  });
});
