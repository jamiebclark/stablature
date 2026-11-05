import "fake-indexeddb/auto";

/**
 * INV-011: barlines stored as drawn, so bars number the same.
 * INV-012: spaces read only from the app's exact shape.
 * INV-013: runs merge by the rule, no further and no less.
 * INV-014: whitespace changes nothing.
 */
import { describe, expect, it } from "vitest";
import { draftPart } from "@/lib/local/clipboard";
import { countBars, layoutPart } from "@/lib/tab/layout";
import { parseTab } from "@/lib/tab/parse";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";
import { clip, codes, four, rails, staff } from "./unit-helpers";

const tuning = presetById("bass4-e")!;
const kinds = (text: string) => clip(text).clipboard.columns.map((c) => c.kind);
const reps = (text: string) => clip(text).clipboard.columns.map((c) => c.repeat);
const bars = (text: string) => countBars(draftPart(clip(text).clipboard).events);

describe("INV-011 barlines", () => {
  it("-7-|-5-|-3- is two barlines and three bars", () => {
    const text = four("-7-|-5-|-3-");
    expect(bars(text)).toBe(3);
    expect(kinds(text).filter((k) => k === "barline")).toHaveLength(2);
  });

  it("-|-7-|- is a barline at each end, and outer pipes hold none", () => {
    const text = staff("GDAE", ["-|-7-|-", "-|---|-", "-|---|-", "-|---|-"]);
    expect(kinds(text)).toEqual(["barline", "notes", "barline"]);
  });

  it("pipes on the outside only hold no barline", () => {
    expect(kinds(four("-7-5-"))).toEqual(["notes", "notes"]);
  });

  it("|| inside a body is one barline", () => {
    const text = staff("GDAE", ["-7-||-5-", "---||---", "---||---", "---||---"]);
    expect(kinds(text).filter((k) => k === "barline")).toHaveLength(1);
  });

  it.each([
    ["opening", "G ||-7-|\nD ||---|\nA ||---|\nE ||---|"],
    ["closing", "G |-7-||\nD |---||\nA |---||\nE |---||"],
    ["both", "G ||-7-||\nD ||---||\nA ||---||\nE ||---||"],
  ])("|| touching the %s is that pipe", (_name, text) => {
    expect(kinds(text)).toEqual(["notes"]);
    expect(bars(text)).toBe(1);
  });

  it("a join with a closing pipe is one barline, and one without is none", () => {
    const closed = (fret: number) => four(`-${fret}-`);
    const open = (fret: number) => closed(fret).replace(/\|$/gm, "");
    expect(kinds(`${closed(5)}\n\n${closed(7)}`)).toEqual(["notes", "barline", "notes"]);
    expect(kinds(`${open(5)}\n\n${open(7)}`)).toEqual(["notes", "notes"]);
  });

  it("SC-006: 16 bars across 4 systems with lyrics number 1 to 16", () => {
    const row = (n: string) => `${n}|---5---|---7---|---5---|---7---|`;
    const rest = (n: string) => `${n}|-------|-------|-------|-------|`;
    const system = [row("G"), rest("D"), rest("A"), rest("E")].join("\n");
    const text = Array.from({ length: 4 }, () => system).join("\nla la la\n");
    const rows = draftPart(clip(text).clipboard);
    expect(countBars(rows.events)).toBe(16);
    const numbers = layoutPart({ events: rows.events, tuning }).columns
      .filter((c) => c.kind === "notes")
      .map((c) => c.barNumber);
    expect(numbers).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });
});

describe("INV-012 rails", () => {
  const spaces = (text: string) => clip(text).spaces;

  it("G |---7---| is a space, a 7 and a space", () => {
    expect(kinds(four("---7---"))).toEqual(["rest", "notes", "rest"]);
    const r = readTab(four("---7---"), { tuning, bandTunings: [], songEvents: [] });
    expect(r.kind === "ready" && r.notes.map((n) => n.kind)).toContain("spaces-read");
  });

  it("E|---7---5---| is two notes", () => {
    const text = staff("GDAE", ["---7---5---", ...Array(3).fill(rails(11))]).replace(/ \|/g, "|");
    expect(spaces(text)).toBe(0);
    expect(kinds(text)).toEqual(["notes", "notes"]);
  });

  it("one row lacking a closing pipe reads no spaces", () => {
    const text = four("---5---").replace(/\|$/m, "");
    expect(spaces(text)).toBe(0);
  });

  it("one even run in an otherwise exact paste reads no spaces", () => {
    expect(spaces(four("-7--5-"))).toBe(0);
  });

  it("two systems of which one is not exact read no spaces", () => {
    const exact = four("---5---");
    expect(spaces(`${exact}\n\n${exact.replace(/ \|/g, "|")}`)).toBe(0);
  });

  it("pipes misaligned by one read no spaces, or refuse", () => {
    const text = four("---5---").replace("D |", "D  |");
    const parsed = parseTab(text);
    if (parsed.ok) expect(parsed.spaces).toBe(0);
  });

  it("a space beside a connector, a two-digit column and a barline", () => {
    const text = staff("GDAE", ["-5--h7---12---|---7-", ...Array(3).fill("--------------|-----")]);
    const r = parseTab(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.spaces).toBeGreaterThan(0);
  });
});

describe("INV-013 the group table", () => {
  const under = (bracket: string, body: string) => `    ${bracket}\n${four(body)}`;

  it("counted, number equals the drawn columns: nothing merges", () => {
    expect(reps(under(",-3-,", "-5-5-5-"))).toEqual([1, 1, 1]);
  });

  it("counted, more drawn than the number: merges earliest first to reach it", () => {
    const body = "-3-5-5-5-5-5-5-5-5-7-";
    expect(reps(under(",--------3--------,", body))).toEqual([1, 8, 1]);
  });

  it("counted, the number cannot be reached: nothing merges, number kept", () => {
    const r = clip(under(",3,", "-5-7-"));
    expect(r.clipboard.columns.map((c) => [c.repeat, c.tupletCount])).toEqual([
      [1, 3],
      [1, 3],
    ]);
  });

  it("plain: nothing merges", () => {
    expect(reps(under(",-----,", "-5-5-5-5-"))).toEqual([1, 1, 1, 1]);
  });

  it("a partial saving merges nothing", () => {
    expect(reps(under(",-------,", "-5-5-7-9-3-").replace(",-------,", ",---3---,"))).toEqual([1, 1, 1, 1, 1]);
  });
});

describe("INV-013 what stops a run", () => {
  it("5h7h7h7: the arrivals merge and the 5 does not", () => {
    expect(reps(four("-5h7h7h7-"))).toEqual([1, 3]);
  });

  it("a barline", () => {
    const text = staff("GDAE", ["-5-5-|-5-5-", ...Array(3).fill("-----|-----")]);
    expect(reps(text)).toEqual([2, 1, 2]);
  });

  it("a technique on one of them", () => {
    expect(reps(four("-5-5~-5-"))).toEqual([1, 1, 1]);
  });

  it("a chord on the first column does not stop it, on a later column does", () => {
    const row = (chords: string) => `${chords}\n${four("-5-5-5-")}`;
    expect(reps(row("    Am"))).toEqual([3]);
    expect(reps(row("      Am"))).toEqual([1, 2]);
  });

  it("a group edge", () => {
    expect(reps(`      ,-,\n${four("-5-5-5-5-")}`)).toEqual([1, 1, 1, 1]);
  });

  it("a join with a barline stops it, a join without does not", () => {
    const closed = four("-5-5-");
    const open = closed.replace(/\|$/gm, "");
    expect(reps(`${closed}\n\n${closed}`)).toEqual([2, 1, 2]);
    expect(reps(`${open}\n\n${open}`)).toEqual([4]);
  });

  it("any label anywhere, in another system, stops every merge", () => {
    const text = `${four("-5-5-5-")}\n\n${four("-7x2-")}`;
    expect(clip(text).density).toBe("compact");
    expect(reps(text)).toEqual([1, 1, 1, 1, 2]);
  });

  it("a run of spaces merges like any other", () => {
    expect(reps(four("-5-------7-"))).toEqual([1, 3, 1]);
  });

  it("counted with a chord mid-run", () => {
    const text = `      Am\n    ,--------3--------,\n${four("-5-5-5-5-5-5-5-5-5-7-")}`;
    const r = clip(text);
    const sum = r.clipboard.columns.reduce((n, c) => n + c.repeat, 0);
    expect(sum).toBe(10);
    expect(r.clipboard.columns.every((c) => c.tupletCount === 3)).toBe(true);
  });
});

describe("INV-013 runs at the repeat cap", () => {
  const run = (n: number) => `-${"5-".repeat(n)}`;

  it.each([
    [512, [512]],
    [513, [512, 1]],
    [1025, [512, 512, 1]],
  ])("%i identical columns", (n, expected) => {
    expect(reps(four(run(n)))).toEqual(expected);
  });

  /** FR-020: everything read stays inside repeat 1 to 512. Reading repeats: a run may merge in a group. */
  it.each([520, 1030])("%i identical columns under a counted bracket stay within 512", (n) => {
    const body = `${run(n)}7-`;
    const width = body.length - 2;
    const inner = width - 2;
    const left = Math.floor((inner - 1) / 2);
    const bracket = `,${"-".repeat(left)}2${"-".repeat(inner - left - 1)},`;
    const text = `    ${bracket}\n${four(body)}`;
    const r = clip(text);
    for (const c of r.clipboard.columns) expect(c.repeat).toBeLessThanOrEqual(512);
  });
});

describe("INV-014 whitespace changes nothing", () => {
  const base = four("-5-12---7-|-9-");
  const same = (a: string, b: string) => expect(clip(a).clipboard).toEqual(clip(b).clipboard);
  const each = (t: string, f: (l: string, i: number) => string) => t.split("\n").map(f).join("\n");

  it("CRLF, CR, trailing spaces, a trailing newline, a BOM", () => {
    same(base.replace(/\n/g, "\r\n"), base);
    same(base.replace(/\n/g, "\r"), base);
    same(base.replace(/\n/g, "   \n"), base);
    same(`${base}\n`, base);
    same(`﻿${base}`, base);
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])("a gutter of %i, equal", (n) => {
    same(each(base, (l) => " ".repeat(n) + l), base);
  });

  it("gutters of 0 to 8, unequal, on a paste that is not exact", () => {
    const loose = base.replace(/ \|/g, "|");
    same(each(loose, (l, i) => " ".repeat(i * 2) + l), loose);
  });

  it("non-breaking spaces in the gutter", () => {
    same(each(base, (l) => `  ${l}`), base);
  });

  it("E| against E | on a paste that is not exact", () => {
    const body = ["-5--7-", "------", "------", "------"];
    const flush = body.map((b, i) => `${"GDAE"[i]}|${b}|`).join("\n");
    const spaced = body.map((b, i) => `${"GDAE"[i]} |${b}|`).join("\n");
    same(flush, spaced);
  });

  it.each(["E", "Eb", "F#"])("label width %s, unpadded beside a one-letter label", (label) => {
    const text = (top: string) => `${top}|--5-7--|\nA|-------|`;
    same(text(label), text("E"));
  });

  it("a two-digit cell aligned at either end", () => {
    const left = "G|--12-|\nD|--5--|\nA|-----|\nE|-----|";
    const right = "G|--12-|\nD|---5-|\nA|-----|\nE|-----|";
    same(left, right);
  });

  it("gutters do not move a chord off its column", () => {
    const text = `    Am\n${four("-5-7-")}`;
    const pushed = each(text, (l) => `  ${l}`);
    same(pushed, text);
  });
});

describe("refused shapes around rails", () => {
  it("rows of different lengths with closing pipes", () => {
    expect(codes(staff("GD", ["-5---", "---"]))).toContain("row-length");
  });

  it("rows of different lengths with no closing pipes, differing only in rails, are accepted", () => {
    expect(codes("G|--5--\nD|---\nA|-----\nE|-----")).toEqual([]);
  });

  it("rows of different lengths with no closing pipes, with a note past the short row, refuse", () => {
    expect(codes("G|--5--7\nD|---\nA|-----\nE|-----")).toContain("row-length");
  });
});
