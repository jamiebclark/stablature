/**
 * Round 4. INV-008: never does a refusal lack a reason. FR-018: "a reason in plain words". SC-004:
 * "the person can tell which line to fix and why". A reason that is untrue fails all three.
 *
 * T073 sends a note-name row with one cell and no rail after it to `row-length`, whose reason is
 * that the strings differ in length. Here they do not. These rows are spelled as S3 says a row is,
 * and each is the same length as the others.
 *
 * A MINOR, and these stay red until someone takes the follow-up: neither paste could import as it
 * stands, so only the reason is wrong. Not for adoption until then.
 */
import { describe, expect, it } from "vitest";
import { parseTab } from "@/lib/tab/parse";

const CASES: [string, string[]][] = [
  ["one note on each string", ["G-5", "D-5", "A-3", "E-3"]],
  ["one note on each string, closing pipes", ["G-5|", "D-5|", "A-3|", "E-3|"]],
  ["dead notes", ["G-x", "D-x", "A-x", "E-x"]],
];

describe("INV-008 rows of equal length are not told they differ in length", () => {
  it.each(CASES)("%s", (_name, rows) => {
    const r = parseTab(rows.join("\n"));
    const codes = r.ok ? [] : r.refusals.map((x) => x.code);
    expect(codes).not.toContain("row-length");
  });
});

/**
 * No row here has a run of three rails, so nothing anchors a block (F43), and S4 takes the bracket
 * for the one row it can see. The paste refuses either way. Only the reason is wrong: it blames the
 * comma of a well-formed bracket.
 */
describe("INV-008 a well-formed bracket is not told its comma is a bad character", () => {
  it("a bracket that is the only line S4 claims", () => {
    const rows = [" ,---3---,", "-5-7-5-7-5-", "-3-3-3-3-3-", "-3-3-3-3-3-", "-3-3-3-3-3-"];
    const r = parseTab(rows.join("\n"));
    expect(r.ok ? [] : r.refusals.map((x) => x.code)).not.toContain("bad-character");
  });
});
