/**
 * Round 6. spec.md line 223 refuses two notes with no gap. Its test is fret text over 36, which is
 * how `57` shows up, and the Assumptions accept a run-together `35` because the preview shows it as
 * written. A leading zero passes the first and breaks the second: `Number("00")` is 0, so `00` stores
 * one open string, `0000` stores one for four, and `05` draws as `5`. So a run of open strings, which
 * is ordinary in hand-typed bass tab, loses all but one of its notes with nothing listed.
 *
 * Every cell here is fret text starting on a zero with a digit after it, so every paste must refuse
 * as `run-together`. The guards keep every fret that holds a zero and is not in doubt.
 */
import { describe, expect, it } from "vitest";
import { eventsOf, imported, reading, world } from "./unit-helpers";

const row = (cell: string) => {
  const rails = "-".repeat(cell.length);
  return [`G |-${cell}-|`, `D |-${rails}-|`, `A |-${rails}-|`, `E |-${rails}-|`].join("\n");
};

describe("INV-006 zeros run together are not one note", () => {
  it.each(["00", "000", "0000", "05", "07", "09", "007", "012", "036", "(00)", "<05>", "t00", "00b", "00x3"])(
    "%s",
    async (cell) => {
      const w = await world("bass4-e");
      const r = await reading(w, row(cell));
      expect(r.kind === "refused" ? r.refusals.map((x) => x.code) : r.kind).toEqual(["run-together"]);
    },
  );

  it("what is stored when it is not", async () => {
    const w = await world("bass4-e");
    const text = ["G |-----------|", "D |-----------|", "A |-----------|", "E |-000-000---|"].join("\n");
    const r = await reading(w, text);
    if (r.kind !== "ready") return;
    const { part } = await imported(w, text);
    const notes = (await eventsOf(w, part.id)).filter((e) => "3" in e.frets);
    console.log("stored:", JSON.stringify(notes.map((e) => [e.frets, e.repeat])));
    // Six open strings on the bottom row of the paste, as a person reads it.
    expect(notes.reduce((n, e) => n + e.repeat, 0)).toBe(6);
  });
});

describe("INV-006 a zero that is not in doubt keeps reading", () => {
  it.each(["0", "10", "20", "30", "0x3", "(0)", "<0>", "t0", "0b", "(<0>)", "x"])("%s", async (cell) => {
    const w = await world("bass4-e");
    expect((await reading(w, row(cell))).kind).toBe("ready");
  });
});
