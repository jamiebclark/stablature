import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";
import { HlcClock } from "../../hlc";
import { newId } from "../../ids";
import { toAscii } from "../../tab/ascii";
import { presetById } from "../../tunings";
import { StablatureDb } from "../db";
import {
  appendBarline,
  appendNote,
  insertBarline,
  insertNote,
  bumpColumnRepeat,
  createBand,
  createPart,
  createSong,
  createTuningFromPreset,
  createVariant,
  deleteLastColumn,
  nextPartLabel,
  nextVariantLabel,
  setChord,
  setColumnRepeat,
  setDefaultTuning,
  slugify,
  stackNote,
  tripletFromTail,
  ungroupTuplet,
  unstackNote,
} from "../editing";
import { listAnnotations, listEvents, listParts, listTunings, resolveTuning } from "../queries";

const bass5 = presetById("bass5-b")!;

let db: StablatureDb;
let clock: HlcClock;

beforeEach(async () => {
  db = new StablatureDb(`test-${newId()}`);
  await db.open();
  let now = 1_000_000;
  clock = new HlcClock("testnode", () => (now += 1));
});

const ctx = () => ({ db, clock });

/** A band with a song and one empty part -- the state capture starts from. */
async function scaffold() {
  const band = await createBand("Hollow Crown", ctx());
  const tuning = await createTuningFromPreset(band.id, bass5, true, ctx());
  const song = await createSong(band.id, "Dirge", tuning.id, ctx());
  const part = await createPart(song, ctx());
  return { band, tuning, song, part };
}

const staff = async (partId: string) =>
  toAscii({ events: await listEvents(partId, db), tuning: bass5 });

describe("naming", () => {
  it("letters parts in sequence", () => {
    expect(nextPartLabel([])).toBe("A");
    expect(nextPartLabel([{ label: "A" }, { label: "B" }])).toBe("C");
  });

  it("fills a gap left by a deleted part", () => {
    expect(nextPartLabel([{ label: "A" }, { label: "C" }])).toBe("B");
  });

  it("carries on past Z", () => {
    const taken = Array.from({ length: 26 }, (_, i) => ({
      label: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[i],
    }));
    expect(nextPartLabel(taken)).toBe("AA");
  });

  it("primes variant labels", () => {
    expect(nextVariantLabel({ label: "A" }, [{ label: "A" }])).toBe("A'");
    expect(nextVariantLabel({ label: "A" }, [{ label: "A" }, { label: "A'" }])).toBe("A''");
  });

  it("slugs band names", () => {
    expect(slugify("Hollow Crown")).toBe("hollow-crown");
    expect(slugify("  !!! Møre  ")).toBe("m-re");
    expect(slugify("***")).toMatch(/^band-/);
  });
});

describe("capture", () => {
  it("appends notes left to right", async () => {
    const { part } = await scaffold();
    await appendNote(part, 3, 7, ctx());
    await appendNote(part, 3, 5, ctx());
    await appendNote(part, 2, 3, ctx());

    expect(await staff(part.id)).toBe(
      ["G |-------|", "D |-------|", "A |-----3-|", "E |-7-5---|", "B |-------|"].join("\n"),
    );
  });

  it("records a repeated note as one column, not eight", async () => {
    const { part } = await scaffold();
    const note = await appendNote(part, 3, 7, ctx());
    await setColumnRepeat(note.id, 8, ctx());

    // One stored row ...
    const stored = await listEvents(part.id, db);
    expect(stored).toHaveLength(1);
    expect(stored[0].repeat).toBe(8);
    // ... that still draws as eight hits.
    expect((await staff(part.id)).split("\n")[3]).toBe("E |-7-7-7-7-7-7-7-7-|");
  });

  it("bumps a repeat without dropping below one", async () => {
    const { part } = await scaffold();
    const note = await appendNote(part, 3, 7, ctx());

    await bumpColumnRepeat(note, 3, ctx());
    expect((await listEvents(part.id, db))[0].repeat).toBe(4);

    await bumpColumnRepeat({ id: note.id, repeat: 4 }, -10, ctx());
    expect((await listEvents(part.id, db))[0].repeat).toBe(1);
  });

  it("stacks notes into a chord on one column", async () => {
    const { part } = await scaffold();
    const note = await appendNote(part, 3, 7, ctx());
    await stackNote(note, 2, 5, ctx());

    expect(await listEvents(part.id, db)).toHaveLength(1);
    expect((await staff(part.id)).split("\n").slice(2, 4)).toEqual(["A |-5-|", "E |-7-|"]);
  });

  it("removes a stacked note, and the column once it is empty", async () => {
    const { part } = await scaffold();
    const note = await appendNote(part, 3, 7, ctx());
    const chord = await stackNote(note, 2, 5, ctx());

    await unstackNote(chord, 2, ctx());
    expect((await listEvents(part.id, db))[0].frets).toEqual({ "3": 7 });

    await unstackNote({ ...chord, frets: { "3": 7 } }, 3, ctx());
    expect(await listEvents(part.id, db)).toHaveLength(0);
  });

  it("deletes the last column, which is how mistakes get fixed", async () => {
    const { part } = await scaffold();
    await appendNote(part, 3, 7, ctx());
    await appendNote(part, 3, 99, ctx());

    const removed = await deleteLastColumn(part.id, ctx());
    expect(removed?.frets).toEqual({ "3": 99 });
    expect((await staff(part.id)).split("\n")[3]).toBe("E |-7-|");
  });

  it("is a no-op when deleting from an empty part", async () => {
    const { part } = await scaffold();
    expect(await deleteLastColumn(part.id, ctx())).toBeUndefined();
  });

  it("appends barlines that divide the part into bars", async () => {
    const { part } = await scaffold();
    await appendNote(part, 3, 7, ctx());
    await appendBarline(part, ctx());
    await appendNote(part, 3, 5, ctx());

    expect((await staff(part.id)).split("\n")[3]).toBe("E |-7-|-5-|");
  });

  it("captures a dead note", async () => {
    const { part } = await scaffold();
    await appendNote(part, 3, "x", ctx());
    expect((await staff(part.id)).split("\n")[3]).toBe("E |-x-|");
  });
});

describe("inserting at a cursor", () => {
  /** Capture the skeleton of a riff, the way you would before fleshing it out. */
  async function roots() {
    const scaffolded = await scaffold();
    await appendNote(scaffolded.part, 3, 7, ctx());
    await appendNote(scaffolded.part, 3, 5, ctx());
    return scaffolded;
  }

  it("drops a note between two existing ones", async () => {
    const { part } = await roots();
    const events = await listEvents(part.id, db);

    await insertNote(part, events, events[0].id, 3, 3, ctx());

    expect((await staff(part.id)).split("\n")[3]).toBe("E |-7-3-5-|");
  });

  it("inserts at the very start", async () => {
    const { part } = await roots();
    const events = await listEvents(part.id, db);

    await insertNote(part, events, null, 3, 12, ctx());

    expect((await staff(part.id)).split("\n")[3]).toBe("E |-12-7-5-|");
  });

  it("appends when the cursor is the last column", async () => {
    const { part } = await roots();
    const events = await listEvents(part.id, db);

    await insertNote(part, events, events[events.length - 1].id, 3, 3, ctx());

    expect((await staff(part.id)).split("\n")[3]).toBe("E |-7-5-3-|");
  });

  it("rewrites nothing but the inserted row", async () => {
    // The whole reason for fractional ranks. Renumbering neighbours would bump
    // their clocks and clobber concurrent edits to them.
    const { part } = await roots();
    const before = await listEvents(part.id, db);
    const clocks = before.map((event) => event.updatedAt);

    await insertNote(part, before, before[0].id, 3, 3, ctx());

    const after = await listEvents(part.id, db);
    for (const original of before) {
      const current = after.find((event) => event.id === original.id)!;
      expect(current.updatedAt).toBe(clocks[before.indexOf(original)]);
    }
  });

  it("supports a run of inserts, each after the last", async () => {
    // Walking the cursor forward is what the capture screen does when you keep
    // tapping after choosing a spot.
    const { part } = await roots();
    let events = await listEvents(part.id, db);
    let cursor: string | null = events[0].id;

    for (const fret of [1, 2, 3]) {
      const inserted = await insertNote(part, events, cursor, 3, fret, ctx());
      cursor = inserted.id;
      events = await listEvents(part.id, db);
    }

    expect((await staff(part.id)).split("\n")[3]).toBe("E |-7-1-2-3-5-|");
  });

  it("falls back to appending when the cursor column is gone", async () => {
    // Reachable through a merge: the column was deleted on another device
    // while it was selected here.
    const { part } = await roots();
    const events = await listEvents(part.id, db);

    await insertNote(part, events, newId(), 3, 3, ctx());

    expect((await staff(part.id)).split("\n")[3]).toBe("E |-7-5-3-|");
  });

  it("inserts a barline at the cursor too", async () => {
    const { part } = await roots();
    const events = await listEvents(part.id, db);

    await insertBarline(part, events, events[0].id, ctx());

    expect((await staff(part.id)).split("\n")[3]).toBe("E |-7-|-5-|");
  });
});

describe("tuplets", () => {
  it("groups the last three columns into a triplet", async () => {
    const { part } = await scaffold();
    await appendNote(part, 3, 7, ctx());
    await appendNote(part, 2, 5, ctx());
    await appendNote(part, 2, 5, ctx());
    await appendNote(part, 2, 5, ctx());

    const tupletId = await tripletFromTail(part.id, 3, ctx());
    expect(tupletId).toBeDefined();

    const events = await listEvents(part.id, db);
    expect(events.map((e) => e.tupletId)).toEqual([null, tupletId, tupletId, tupletId]);
    expect((await staff(part.id)).split("\n")[0]).toBe("      ,-3-,");
  });

  it("skips barlines when grouping from the tail", async () => {
    const { part } = await scaffold();
    await appendNote(part, 2, 5, ctx());
    await appendBarline(part, ctx());
    await appendNote(part, 2, 5, ctx());
    await appendNote(part, 2, 5, ctx());

    await tripletFromTail(part.id, 3, ctx());
    const events = await listEvents(part.id, db);
    const barline = events.find((e) => e.kind === "barline")!;
    // A barline inside a triplet would be meaningless, and grouping must not
    // silently swallow it.
    expect(barline.tupletId).toBeNull();
    expect(events.filter((e) => e.tupletId !== null)).toHaveLength(3);
  });

  it("refuses to make a tuplet of one column", async () => {
    const { part } = await scaffold();
    await appendNote(part, 3, 7, ctx());
    expect(await tripletFromTail(part.id, 3, ctx())).toBeUndefined();
  });

  it("ungroups", async () => {
    const { part } = await scaffold();
    await appendNote(part, 2, 5, ctx());
    await appendNote(part, 2, 5, ctx());
    await tripletFromTail(part.id, 2, ctx());

    await ungroupTuplet(await listEvents(part.id, db), ctx());
    expect((await listEvents(part.id, db)).every((e) => e.tupletId === null)).toBe(true);
  });
});

describe("chords above the staff", () => {
  it("sets, replaces and clears a chord", async () => {
    const { part } = await scaffold();
    const note = await appendNote(part, 3, 7, ctx());

    await setChord(part, note.id, "Am", ctx());
    expect((await listAnnotations(part.id, db)).map((a) => a.value)).toEqual(["Am"]);

    // Setting it again must replace, not stack a second symbol on one column.
    await setChord(part, note.id, "Am7", ctx());
    const after = await listAnnotations(part.id, db);
    expect(after).toHaveLength(1);
    expect(after[0].value).toBe("Am7");

    await setChord(part, note.id, "   ", ctx());
    expect(await listAnnotations(part.id, db)).toHaveLength(0);
  });

  it("renders above the right column", async () => {
    const { part } = await scaffold();
    await appendNote(part, 3, 7, ctx());
    const second = await appendNote(part, 3, 5, ctx());
    await setChord(part, second.id, "C", ctx());

    const events = await listEvents(part.id, db);
    const annotations = await listAnnotations(part.id, db);
    expect(toAscii({ events, tuning: bass5, annotations }).split("\n")[0]).toBe("      C");
  });
});

describe("variants", () => {
  it("copies the base part's columns so it can diverge", async () => {
    const { part } = await scaffold();
    await appendNote(part, 3, 7, ctx());
    await appendNote(part, 3, 5, ctx());

    const variant = await createVariant(part, ctx());

    expect(variant.label).toBe("A'");
    expect(variant.variantOfPartId).toBe(part.id);
    expect(await staff(variant.id)).toBe(await staff(part.id));
  });

  it("gives the copy its own columns, so editing it leaves the base alone", async () => {
    const { part } = await scaffold();
    await appendNote(part, 3, 7, ctx());
    const variant = await createVariant(part, ctx());

    await appendNote(variant, 2, 12, ctx());

    expect((await listEvents(part.id, db))).toHaveLength(1);
    expect((await listEvents(variant.id, db))).toHaveLength(2);
  });

  it("re-anchors copied chords to the copied columns", async () => {
    const { part } = await scaffold();
    const note = await appendNote(part, 3, 7, ctx());
    await setChord(part, note.id, "Am", ctx());

    const variant = await createVariant(part, ctx());
    const [copied] = await listAnnotations(variant.id, db);
    const variantEvents = await listEvents(variant.id, db);

    // A dangling anchor would silently drop the chord from the staff.
    expect(copied.anchorEventId).toBe(variantEvents[0].id);
    expect(copied.anchorEventId).not.toBe(note.id);
  });

  it("appears after the base part in the list", async () => {
    const { song, part } = await scaffold();
    await createVariant(part, ctx());
    expect((await listParts(song.id, db)).map((p) => p.label)).toEqual(["A", "A'"]);
  });
});

describe("tunings", () => {
  it("moves the default to exactly one tuning", async () => {
    const { band } = await scaffold();
    const dropA = await createTuningFromPreset(band.id, presetById("bass5-drop-a")!, false, ctx());

    await setDefaultTuning(await listTunings(band.id, db), dropA.id, ctx());

    const after = await listTunings(band.id, db);
    expect(after.filter((t) => t.isDefault).map((t) => t.id)).toEqual([dropA.id]);
  });

  it("is what a song with no explicit tuning resolves to", async () => {
    const { band, song } = await scaffold();
    const dropA = await createTuningFromPreset(band.id, presetById("bass5-drop-a")!, false, ctx());
    await setDefaultTuning(await listTunings(band.id, db), dropA.id, ctx());

    const loose = await createSong(band.id, "No tuning set", null, ctx());
    expect((await resolveTuning(loose, db))!.id).toBe(dropA.id);
    // The song that names one is unaffected.
    expect((await resolveTuning(song, db))!.id).toBe(song.tuningId);
  });
});
