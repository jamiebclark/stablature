/**
 * INV-006: never is a row with anything on it dropped, moved to another position, or imported
 *          onto a string of another name.
 * INV-009: never does a line that may be a damaged staff row become commentary.
 * Written through `readTab` and `importTab`, and read back from stored `frets`.
 */
import { describe, expect, it } from "vitest";
import { pitchClass } from "@/lib/tab/parse";
import { readTab } from "@/lib/tab/reading";
import { presetById, type Tuning } from "@/lib/tunings";
import {
  customTuning,
  dump,
  eventsOf,
  holdNotes,
  imported,
  reading,
  staff,
  world,
} from "./unit-helpers";

const note = (name: string, octave: number) => ({ note: name, octave });

describe("INV-006 the spec's fit table", () => {
  it("G D A E on G D A E fits", async () => {
    const w = await world("bass4-e");
    const r = await reading(w, staff("GDAE", ["-5-", "-7-", "-9-", "-3-"]));
    expect(r.kind === "ready" && r.fit.kind).toBe("fits");
    expect(r.kind === "ready" && r.notes).toEqual([]);
  });

  it("Eb Bb F C on D# A# F C fits, with the notes on the same keys", async () => {
    const w = await world(null);
    const t = await customTuning(
      w,
      { strings: [note("D#", 2), note("A#", 1), note("F", 1), note("C", 1)] },
      "Sharps",
      true,
    );
    expect(t.isDefault).toBe(true);
    const text = "Eb|-5-|\nBb|-7-|\nF |-9-|\nC |-3-|";
    const { part, reading: r } = await imported(w, text);
    expect(r.fit.kind).toBe("fits");
    expect((await eventsOf(w, part.id))[0].frets).toEqual({ 0: 5, 1: 7, 2: 9, 3: 3 });
  });

  it("G D A E on G D A E B fits, keys unchanged, B empty", async () => {
    const w = await world("bass5-b");
    const { part, reading: r } = await imported(w, staff("GDAE", ["-5-", "---", "---", "-3-"]));
    expect(r.fit.kind).toBe("fits");
    expect((await eventsOf(w, part.id))[0].frets).toEqual({ 0: 5, 3: 3 });
  });

  it("G D A E B with nothing on B, on G D A E: fits, and the left-out row is named", async () => {
    const w = await world("bass4-e");
    const r = await reading(w, staff("GDAEB", ["-5-", "---", "---", "-3-", "---"]));
    expect(r.kind === "ready" && r.fit.kind).toBe("fits");
    expect(r.kind === "ready" && r.notes.map((n) => n.kind)).toContain("row-left-out");
  });

  it("G D A E B with notes on B, on G D A E holding a note: offered, never squeezed", async () => {
    const w = await world("bass4-e");
    await holdNotes(w, [0, 3]);
    const r = await reading(w, staff("GDAEB", ["-5-", "---", "---", "---", "-3-"]));
    expect(r.kind === "ready" && r.fitKey).toBe("preset:bass5-b");
  });

  it("G D A D with notes on the low row, on G D A E holding a low note: refused", async () => {
    const w = await world("bass4-e");
    await holdNotes(w, [3]);
    const r = await reading(w, staff("GDAD", ["---", "---", "---", "-3-"]));
    expect(r.kind).toBe("refused");
  });

  it("E A D G on G D A E: refused as lowest first", async () => {
    const w = await world("bass4-e");
    const r = await reading(w, staff("EADG", ["-3-", "---", "---", "-5-"]));
    expect(r.kind === "refused" && r.refusals[0].code).toBe("rows-lowest-first");
  });
});

describe("INV-006 a note on every single row in turn", () => {
  const presets = ["bass4-e", "bass5-b", "guitar6-e"];
  for (const id of presets) {
    const tuning = presetById(id)!;
    const names = tuning.strings.map((s) => s.note);
    for (let at = 0; at < names.length; at += 1) {
      const bodies = names.map((_, i) => (i === at ? "---5---" : "-------"));

      it(`${id}: labelled, row ${at}`, async () => {
        const w = await world(id);
        const text = names.map((n, i) => `${n} |${bodies[i]}|`).join("\n");
        const { part } = await imported(w, text);
        const events = await eventsOf(w, part.id);
        const noted = events.filter((e) => Object.keys(e.frets).length > 0);
        expect(noted.map((e) => e.frets)).toEqual([{ [at]: 5 }]);
      });

      it(`${id}: unlabelled with pipes, row ${at}`, async () => {
        const w = await world(id);
        const { part } = await imported(w, bodies.map((b) => `|${b}|`).join("\n"));
        const events = await eventsOf(w, part.id);
        expect(events.filter((e) => e.kind === "notes").map((e) => e.frets)).toEqual([{ [at]: 5 }]);
      });

      it(`${id}: unlabelled with no pipes, row ${at}`, async () => {
        // FR-015: exactly as many unlabelled rows as strings MUST be accepted, read top down.
        const w = await world(id);
        const { part } = await imported(w, bodies.join("\n"));
        const events = await eventsOf(w, part.id);
        expect(events.filter((e) => e.kind === "notes").map((e) => e.frets)).toEqual([{ [at]: 5 }]);
      });
    }
  }
});

/**
 * The same notes, five rows, unlabelled, no pipes, empty top row, into a four-string song.
 * Row 1 of the paste is a different string from row 0 of the song, so whatever else happens, a
 * note on the paste's second row must not arrive on string 0.
 */
describe("INV-006 an empty row must not shift the rows below it", () => {
  const rows = ["-------", "---5---", "---7---", "---9---", "---3---"];

  it("five unlabelled rows, empty top row, on four strings: never lands one string up", async () => {
    const w = await world("bass4-e");
    const r = await reading(w, rows.join("\n"));
    if (r.kind === "ready") {
      // Row index in the paste must be the stored key, or it must refuse.
      const keys = r.clipboard.columns.flatMap((c) => Object.keys(c.frets)).map(Number);
      expect(Math.min(...keys), "the paste's second row is string 1, not string 0").toBeGreaterThan(0);
    }
  });

  it("six unlabelled rows, empty top row, on five strings", async () => {
    const w = await world("bass5-b");
    const six = ["-------", "---5---", "---7---", "---9---", "---3---", "---1---"];
    const r = await reading(w, six.join("\n"));
    if (r.kind === "ready") {
      const keys = r.clipboard.columns.flatMap((c) => Object.keys(c.frets)).map(Number);
      expect(Math.min(...keys)).toBeGreaterThan(0);
    }
  });

  it("the same paste with pipes refuses, which is the right answer", async () => {
    const w = await world("bass4-e");
    expect((await reading(w, rows.map((b) => `|${b}|`).join("\n"))).kind).toBe("refused");
  });
});

describe("INV-006 names", () => {
  const song = (id: string): { tuning: Tuning; bandTunings: []; songEvents: [] } => ({
    tuning: presetById(id)!,
    bandTunings: [],
    songEvents: [],
  });

  it.each([
    ["e for E", "g|-5-|\nd|---|\na|---|\ne|-3-|"],
    ["E1 for E", "G2|-5-|\nD2|---|\nA1|---|\nE1|-3-|"],
    ["wrong octave ignored", "G5|-5-|\nD5|---|\nA5|---|\nE5|-3-|"],
  ])("%s fits", (_name, text) => {
    const r = readTab(text, song("bass4-e"));
    expect(r.kind === "ready" && r.fit.kind).toBe("fits");
  });

  it("every stored key names the label at that position", async () => {
    for (const id of ["bass4-e", "bass5-b", "guitar6-e", "bass6-b"]) {
      const tuning = presetById(id)!;
      const names = tuning.strings.map((s) => s.note);
      const w = await world(id);
      const text = names.map((n, i) => `${n.padEnd(2)} |-${i + 1}-|`).join("\n");
      const { part } = await imported(w, text);
      const [column] = await eventsOf(w, part.id);
      for (const [key, fret] of Object.entries(column.frets)) {
        expect(pitchClass(names[Number(key)])).toBe(pitchClass(tuning.strings[Number(key)].note));
        expect(fret).toBe(Number(key) + 1);
      }
    }
  });

  it("six rows on five strings with notes held: refused, nothing lost", async () => {
    const w = await world("bass5-b");
    await holdNotes(w, [0, 1, 2, 3, 4]);
    const before = await dump(w);
    const r = await reading(w, staff("EBGDAE", ["-5-", "-5-", "-5-", "-5-", "-5-", "-5-"]));
    expect(r.kind).toBe("refused");
    expect(await dump(w)).toBe(before);
  });
});

describe("INV-009 a damaged row never becomes commentary", () => {
  const damaged = [
    "B |--?--|",
    "B|--?--|",
    "|--?--|",
    "B --?--",
    "B--?--",
    "G-5s7-",
    "T|---",
    "HH|x-x-|",
    "Bass|---|",
    "---?---5---",
  ];

  for (const rowsN of [4, 5]) {
    const names = "GDAEB".slice(0, rowsN).split("");
    const id = rowsN === 4 ? "bass4-e" : "bass5-b";
    for (const at of [0, Math.floor(rowsN / 2), rowsN - 1]) {
      it.each(damaged)(`${rowsN} rows, position ${at}: %s`, (bad) => {
        const lines = names.map((n) => `${n} |--5--|`);
        lines[at] = bad;
        const r = readTab(lines.join("\n"), { tuning: presetById(id)!, bandTunings: [], songEvents: [] });
        expect(r.kind).toBe("refused");
      });
    }
  }

  /**
   * The edge-case list refuses "a long dash", and says it is what a phone leaves in place of `--`.
   * With no pipe to trip S1, nothing else stops the row becoming commentary.
   */
  describe("a long dash on a row with no pipes", () => {
    const longDashed = ["E—5—7—", "E–5–7–", "E—5—", "E — 5 — 7"];
    for (const at of [0, 3]) {
      it.each(longDashed)(`position ${at}: %s`, (bad) => {
        const lines = ["G-5--7--", "D-5--7--", "A-5--7--", "E-5--7--"];
        lines[at] = bad;
        const r = readTab(lines.join("\n"), {
          tuning: presetById("bass4-e")!,
          bandTunings: [],
          songEvents: [],
        });
        expect(r.kind, "a row of notes is on this line").toBe("refused");
      });
    }
  });
});
