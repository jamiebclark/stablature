/**
 * The reader's enumerations (INV-007, INV-008, INV-011, INV-013 to INV-017).
 * Contract: specs/004-ascii-import/contracts/reader.md.
 */
import { describe, expect, it } from "vitest";
import { draftPart } from "../../local/clipboard";
import type { Technique } from "../../model";
import { toAscii } from "../ascii";
import { parseTab, type RefusalCode } from "../parse";
import { DECORATIONS, TRANSITIONS } from "../techniques";
import { ev, bass5, barline, space } from "./helpers";

function read(text: string) {
  const result = parseTab(text);
  if (!result.ok) throw new Error(result.refusals.map((r) => `${r.line}:${r.code}`).join(","));
  return result;
}

function codes(text: string): RefusalCode[] {
  const result = parseTab(text);
  return result.ok ? [] : result.refusals.map((r) => r.code);
}

const draw = (events: ReturnType<typeof ev>[], density: "expanded" | "compact" = "expanded") =>
  toAscii({ events, tuning: bass5, density });

describe("refusals (INV-007, INV-008)", () => {
  const rows = (body: string[]) => body.map((b, i) => `${"GDAEB"[i]} |${b}|`).join("\n");
  const plain = ["-----", "-----", "-5---", "-----", "-----"];
  const cases: [RefusalCode, string][] = [
    ["bad-character", rows(["-5s7-", ...plain.slice(1)])],
    ["run-together", rows(["-7b9-", ...plain.slice(1)])],
    ["fret-range", rows(["-57--", ...plain.slice(1)])],
    ["decoration-order", rows(["-7~b-", ...plain.slice(1)])],
    ["long-dash", rows(["-5—7-", ...plain.slice(1)])],
    ["space-in-body", rows(["-5 7-", ...plain.slice(1)])],
    ["repeat-sign", `${rows(plain)} x4`],
    ["partial-barline", rows(["--5--|--7--", "-----|-----", "-----------", "-----------", "-----------"])],
    ["row-length", rows(["-5---", "---", "-----", "-----", "-----"])],
    ["repeat-range", rows(["-7x0-", ...plain.slice(1)])],
    ["connector-unjoined", rows(["--h7-", ...plain.slice(1)])],
    ["connector-double", rows(["-5h/7-", "------", "------", "------", "------"])],
    ["labels-mixed", "G |--5--|\n  |-----|"],
    ["label-unknown", "T |--5--|\nA |-----|"],
    ["lone-row", "G |--5--|"],
    ["no-staff", "just some lyrics\nand another line"],
    ["no-notes", rows(["-----", "-----", "-----", "-----", "-----"])],
  ];

  it.each(cases)("%s", (code, text) => {
    expect(codes(text)).toContain(code);
  });

  it("never throws, whatever the text", () => {
    for (const text of ["", "\u0000", "|", "|||", "E|", ",,,", "x".repeat(5000), "\r\r\n\n"]) {
      expect(() => parseTab(text)).not.toThrow();
    }
  });

  it("returns refusals in line order, one per line, with no partial result", () => {
    const result = parseTab("G |-5s-|\nD |-----|\nA |-5 7-|\nE |-----|");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const lines = result.refusals.map((r) => r.line ?? 0);
      expect(lines).toEqual([...lines].sort((a, b) => a - b));
      expect(new Set(lines).size).toBe(lines.length);
    }
  });

  it("refuses a heading above a second system", () => {
    const one = draw([ev({ 2: 5 })]);
    expect(codes(`${one}\nC\n${one}`)).toContain("several-parts");
  });
});

describe("barlines (INV-011)", () => {
  it.each([
    ["first", [barline(), ev({ 2: 5 }), ev({ 2: 7 })]],
    ["middle", [ev({ 2: 5 }), barline(), ev({ 2: 7 })]],
    ["last", [ev({ 2: 5 }), ev({ 2: 7 }), barline()]],
    ["only notes either side", [ev({ 2: 5 }), barline(), barline(), ev({ 2: 7 })]],
  ])("a barline in the %s place comes back where it was", (_name, events) => {
    const reading = read(draw(events));
    expect(reading.clipboard.columns.map((c) => c.kind)).toEqual(events.map((e) => e.kind));
  });

  it("a || touching the outer pipe is that pipe", () => {
    const reading = read("G ||---5---||\nD ||---7---||");
    expect(reading.clipboard.columns.every((c) => c.kind !== "barline")).toBe(true);
  });
});

describe("runs merge (INV-013)", () => {
  const five = () => ev({ 2: 5 });

  it.each([512, 513, 1025])("%i identical columns split at the repeat cap", (n) => {
    const text = draw(Array.from({ length: n }, five));
    const repeats = read(text).clipboard.columns.map((c) => c.repeat);
    expect(repeats.reduce((a, b) => a + b, 0)).toBe(n);
    expect(Math.max(...repeats)).toBeLessThanOrEqual(512);
  });

  it("a barline stops a run, as does a different fret", () => {
    const reading = read(draw([five(), five(), barline(), five(), ev({ 2: 7 })]));
    expect(reading.clipboard.columns.map((c) => c.repeat)).toEqual([2, 1, 1, 1]);
  });

  it("compact text with labels merges nothing", () => {
    const reading = read(draw([ev({ 2: 5 }, {}, { repeat: 8 }), five()], "compact"));
    expect(reading.density).toBe("compact");
    expect(reading.clipboard.columns.map((c) => c.repeat)).toEqual([8, 1]);
  });

  it("spaces merge like any other column", () => {
    const reading = read(draw([five(), space(), space(), space(), five()]));
    expect(reading.clipboard.columns.map((c) => [c.kind, c.repeat])).toEqual([
      ["notes", 1],
      ["rest", 3],
      ["notes", 1],
    ]);
  });
});

describe("chords (INV-015)", () => {
  const chordAt = (value: string, anchor: ReturnType<typeof ev>) => ({
    id: `c-${value}`,
    bandId: "band",
    partId: "part",
    anchorEventId: anchor.id,
    kind: "chord" as const,
    value,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
  });

  it("reads Am then G on their own columns", () => {
    const a = ev({ 2: 5 });
    const b = ev({ 2: 7 });
    const c = ev({ 2: 9 });
    const text = toAscii({
      events: [a, b, c],
      tuning: bass5,
      annotations: [chordAt("Am", a), chordAt("G", c)],
    });
    const reading = read(text);
    expect(reading.clipboard.annotations).toEqual([
      { columnIndex: 0, kind: "chord", value: "Am" },
      { columnIndex: 2, kind: "chord", value: "G" },
    ]);
  });

  it("splits AmDm at the column starts, and keeps Am7 whole", () => {
    const text = ["    AmDm Am7", "G |-5-7-9-|", "D |-------|"].join("\n");
    const reading = read(text);
    expect(reading.clipboard.annotations.map((a) => a.value)).toEqual(["Am", "Dm", "Am7"]);
  });

  it("reads N.C. as a chord", () => {
    const a = ev({ 2: 5 });
    const text = toAscii({ events: [a, ev({ 2: 7 })], tuning: bass5, annotations: [chordAt("N.C.", a)] });
    expect(read(text).clipboard.annotations[0].value).toBe("N.C.");
  });

  it("a lone symbol flush left is not a chord row", () => {
    const reading = read("A\nG |-5-|\nD |---|");
    expect(reading.clipboard.annotations).toEqual([]);
  });

  it("refuses a symbol over the limit sync enforces", () => {
    expect(codes(`   C${"7".repeat(210)}\nG |-5-|\nD |---|`)).toContain("chord-too-long");
  });
});

describe("decorations and transitions (INV-016, INV-017)", () => {
  const subsets: Technique[][] = Array.from({ length: 1 << DECORATIONS.length }, (_, mask) =>
    DECORATIONS.filter((_, i) => (mask >> i) & 1).map((d) => d.id),
  ).slice(1);

  it.each(["7", "12", "x"])("all 63 decoration subsets on %s read back", (fret) => {
    const value = fret === "x" ? ("x" as const) : Number(fret);
    for (const ids of subsets) {
      const source = ev({ 2: value }, { "2": ids });
      const text = draw([source, ev({ 2: 3 })]);
      const reading = read(text);
      const back = draftPart(reading.clipboard).events[0];
      expect(new Set(back.techniques["2"] ?? [])).toEqual(new Set(ids));
      expect(back.frets).toEqual({ 2: value });
    }
  });

  it("x stores no dead_note", () => {
    const back = draftPart(read(draw([ev({ 2: "x" }), ev({ 2: 3 })]).replace(/x/g, "X")).clipboard);
    expect(back.events[0].frets).toEqual({ 2: "x" });
    expect(JSON.stringify(back.events[0].techniques)).not.toContain("dead_note");
  });

  it.each(TRANSITIONS.map((t) => [t.id, t.glyph] as const))("%s joins the next note", (id, glyph) => {
    const first = ev({ 2: 5 });
    const second = ev({ 2: 7 }, { "2": [id] });
    const text = draw([first, second]);
    expect(text).toContain(glyph);
    const rows = draftPart(read(text).clipboard).events;
    expect(rows[1].techniques["2"]).toContain(id);
    expect(rows[0].techniques["2"]).toBeUndefined();
  });

  it("a connector across a barline or a space still joins", () => {
    const text = draw([ev({ 2: 5 }), barline(), space(), ev({ 2: 7 }, { "2": ["hammer_on"] })]);
    expect(codes(text)).toEqual([]);
  });
});

describe("groups (spec 003 notation)", () => {
  const group = (events: ReturnType<typeof ev>[], count: number | null) => {
    const id = "grp";
    for (const e of events) {
      e.tupletId = id;
      e.tupletCount = count;
      e.groupKind = count === null ? "plain" : "tuplet";
    }
    return events;
  };

  it("a counted group reads back with its number", () => {
    const events = group([ev({ 2: 1 }), ev({ 2: 2 }), ev({ 2: 3 })], 3);
    const back = draftPart(read(draw(events)).clipboard).events;
    expect(back.map((e) => [e.groupKind, e.tupletCount])).toEqual([
      ["tuplet", 3],
      ["tuplet", 3],
      ["tuplet", 3],
    ]);
    expect(new Set(back.map((e) => e.tupletId)).size).toBe(1);
  });

  it("a plain group reads back with no number", () => {
    const events = group([ev({ 2: 1 }), ev({ 2: 2 })], null);
    const back = draftPart(read(draw(events)).clipboard).events;
    expect(back.map((e) => [e.groupKind, e.tupletCount])).toEqual([
      ["plain", null],
      ["plain", null],
    ]);
  });

  it("refuses a number outside 2 to 16", () => {
    const text = "  ,-1-,\nG |-5-7-|\nD |-----|";
    expect(codes(text)).toContain("bracket-range");
  });

  it("refuses a bracket that ends between columns", () => {
    expect(codes("   ,--,\nG |-5-7-9-|\nD |-------|")).toContain("bracket-placement");
  });
});

describe("rails and spaces (INV-012)", () => {
  it("reads no spaces from a tab outside the app's exact shape", () => {
    expect(read("G|---7---|\nD|-------|").spaces).toBe(0);
    expect(read("G |---7---\nD |-------").spaces).toBe(0);
  });

  it("reads no spaces from one even run in an otherwise exact paste", () => {
    expect(read("G |---7--5---|\nD |----------|").spaces).toBe(0);
  });

  it("reads no spaces when one system is not exact", () => {
    const exact = draw([ev({ 2: 5 }), space(), ev({ 2: 7 })]);
    const loose = exact.replace(/ \|/g, "|");
    expect(read(`${exact}\n${loose}`).spaces).toBe(0);
  });

  it("reads the spaces in the app's exact shape", () => {
    expect(read(draw([ev({ 2: 5 }), space(), space(), ev({ 2: 7 })])).spaces).toBe(2);
  });
});

describe("whitespace changes nothing (INV-014)", () => {
  const base = () => draw([ev({ 2: 5 }), ev({ 2: 12 }), ev({ 3: 7 }), barline(), ev({ 2: 9 }), ev({ 2: 5 })]);
  const clip = (text: string) => read(text).clipboard;
  const indent = (t: string, f: (i: number) => string) =>
    t.split("\n").map((l, i) => `${f(i)}${l}`).join("\n");

  it.each([
    ["crlf", (t: string) => t.replace(/\n/g, "\r\n")],
    ["cr", (t: string) => t.replace(/\n/g, "\r")],
    ["trailing newline", (t: string) => `${t}\n`],
    ["trailing spaces", (t: string) => t.replace(/\n/g, "   \n")],
    ["BOM", (t: string) => `﻿${t}`],
    ["nbsp gutter", (t: string) => indent(t, () => "  ")],
    ["equal gutter 8", (t: string) => indent(t, () => " ".repeat(8))],
    ["unequal gutters", (t: string) => indent(t, (i) => " ".repeat(i))],
  ])("%s", (_name, change) => {
    expect(clip(change(base()))).toEqual(clip(base()));
  });

  it.each(["E", "Eb", "F#"])("label %s, flush or spaced to the pipe", (label) => {
    const rows = (gap: string) =>
      `${label}${gap}|--5-12--|\n${"A".padEnd(label.length)}${gap}|--------|`;
    expect(clip(rows(""))).toEqual(clip(rows(" ")));
  });

  it("two-digit cells align at either end", () => {
    expect(clip("G|-12--5-|\nD|-7-----|")).toEqual(clip("G|-12--5-|\nD|--7----|"));
  });
});

describe("commentary (INV-010)", () => {
  const staff = "G |-5-7-|\nD |-----|";

  it.each([
    "I walk the line tonight",
    "P.M.----|",
    "[Verse]",
    "[A]",
    "(A)",
    "A-men",
    "E-Bow",
    "-------",
    "B'",
  ])("%s above a staff is ignored with its number", (line) => {
    expect(read(`${line}\n\n${staff}`).ignored).toEqual([{ line: 1, text: line }]);
  });

  it("a lyric between systems is ignored and the systems join", () => {
    const r = read(`${staff}\nla la la\n${staff}`);
    expect(r.ignored).toEqual([{ line: 3, text: "la la la" }]);
    expect(r.clipboard.columns.length).toBeGreaterThan(2);
  });

  it("a beat count off the columns is ignored", () => {
    expect(read(`1   2   3   4\n${staff}`).ignored.map((i) => i.line)).toEqual([1]);
  });

  it("flush-left A is not a chord", () => {
    expect(read(`A\n${staff}`).clipboard.annotations).toEqual([]);
  });

  it("export title and meta lines are ignored", () => {
    const r = read(`My Song\nBass, 5 strings\n\n${staff}`);
    expect(r.ignored.map((i) => i.line)).toEqual([1, 2]);
  });
});

describe("every refusal, alone and among good lines (INV-002, INV-007, INV-008, INV-009)", () => {
  const good = "G |--5--|\nD |-----|\nA |-----|\nE |-----|\nB |-----|";
  const system = (row0: string) =>
    `G |${row0}|\nD |-----|\nA |-----|\nE |-----|\nB |-----|`;
  const samples: [RefusalCode, string][] = [
    ["bad-character", system("-5s7-")],
    ["run-together", system("-7b9-")],
    ["fret-range", system("-57--")],
    ["decoration-order", system("-7~b-")],
    ["long-dash", system("-5—7-")],
    ["space-in-body", system("-5 7-")],
    ["repeat-sign", `${good} x4`],
    ["repeat-sign", system(":-5--").replace("|:", "|:")],
    ["cell-overlap", "G |-12--|\nD |--34-|\nA |-----|\nE |-----|\nB |-----|"],
    ["repeat-disagrees", "G |-7x3-|\nD |-5x4-|\nA |-----|\nE |-----|\nB |-----|"],
    ["repeat-range", system("-7x0-")],
    ["repeat-range", system("7x513")],
    ["connector-unjoined", "G |-----|\nD |-----|\nA |-----|\nE |-----|\nB |-h7--|"],
    ["connector-unjoined", system("--7h-")],
    ["connector-double", "G |-5h/7-|\nD |-------|\nA |-------|\nE |-------|\nB |-------|"],
    ["labels-mixed", "G |--5--|\n  |-----|"],
    ["label-unknown", "T |--5--|\nA |-----|"],
    ["lone-row", "G |--5--|"],
    ["bracket-range", ` ,-1-,\n${good}`],
    ["bracket-range", ` ,-17-,\n${good}`],
    ["chord-too-long", `   C${"7".repeat(200)}
${good}`],
  ];

  it.each(samples)("%s alone", (code, text) => {
    expect(codes(text)).toContain(code);
  });

  it.each(samples)("%s among good lines", (code, text) => {
    expect(codes(`${good}\n\n${text}\n\n${good}`)).toContain(code);
    expect(codes(`${text}\n\n${good}`)).toContain(code);
    expect(codes(`${good}\n\n${text}`)).toContain(code);
  });

  it("refuses two systems that differ", () => {
    expect(codes(`${good}\n\nG |--5--|\nD |-----|\nA |-----|\nE |-----|`)).toContain("systems-differ");
  });

  it("refuses a chord with no column, and a collision", () => {
    expect(codes(`Am G\n${good.replace(/-/g, "|")}`).length).toBeGreaterThan(0);
  });

  it("null line only for no-staff and no-notes", () => {
    for (const [code, text] of samples) {
      const result = parseTab(text);
      if (!result.ok) {
        for (const r of result.refusals) {
          if (r.code !== "no-staff" && r.code !== "no-notes") expect(r.line, code).not.toBeNull();
        }
      }
    }
    const lyrics = parseTab("lyrics only");
    expect(!lyrics.ok && lyrics.refusals[0]).toMatchObject({ code: "no-staff", line: null });
    const empty = parseTab("G |-----|\nD |-----|");
    expect(!empty.ok && empty.refusals[0]).toMatchObject({ code: "no-notes", line: null });
  });

  it("collects three bad lines of different codes in order", () => {
    const text = "G |-5s-|\nD |-----|\n\nG |-57-|\nD |-----|\n\nG |-5 7|\nD |-----|";
    const result = parseTab(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusals.map((r) => r.code)).toEqual(["bad-character", "fret-range", "space-in-body"]);
      expect(result.refusals.map((r) => r.line)).toEqual([1, 4, 7]);
    }
  });

  it("handles Windows line endings and a blank first line", () => {
    expect(codes(`\r\n${system("-5s7-")}`.replace(/\n/g, "\r\n"))).toContain("bad-character");
    expect(codes(`\n${system("-5s7-")}`)).toContain("bad-character");
  });

  it("two systems, one bad", () => {
    expect(codes(`${good}\n\n${system("-5s7-")}`)).toContain("bad-character");
  });

  it("refuses any damaged row at the top, middle or bottom of 4 and 5 rows", () => {
    const damaged = [
      "B |--?--|", "B|--?--|", "|--?--|", "B --?--", "B--?--",
      "G-5s7-", "T|---", "HH|x-x-|", "Bass|---|", "---?---5---",
    ];
    for (const rowsN of [4, 5]) {
      const names = "GDAEB".slice(0, rowsN).split("");
      for (const at of [0, Math.floor(rowsN / 2), rowsN - 1]) {
        for (const bad of damaged) {
          const lines = names.map((n) => `${n} |--5--|`);
          lines[at] = bad;
          const result = parseTab(lines.join("\n"));
          expect(result.ok, `${rowsN} rows, row ${at}: ${bad}`).toBe(false);
        }
      }
    }
  });

  it("refuses fret 37 and x0 and x513 cells", () => {
    expect(codes(system("-37--"))).toContain("fret-range");
    expect(codes(system("-x0--"))).not.toEqual([]);
    expect(codes(system("-x513-"))).not.toEqual([]);
  });
});

describe("the three refusals the spec does not list (T029)", () => {
  const good = "G |--5--|\nD |-----|\nA |-----|\nE |-----|\nB |-----|";
  it("two cells inside one wide cell", () => {
    expect(codes("G |-5x12-|\nD |-3-4--|\nA |------|\nE |------|\nB |------|")).toContain("cell-overlap");
  });
  it("two connectors in one gap", () => {
    expect(codes("G |-5h/7-|\nD |-------|\nA |-------|\nE |-------|\nB |-------|")).toContain("connector-double");
  });
  it("a tab character in a chord or bracket row", () => {
    expect(codes(`  Am\t G\n${good}`)).toContain("chord-collision");
    expect(codes(` ,--,\t\n${good}`)).toContain("bracket-placement");
  });
});
