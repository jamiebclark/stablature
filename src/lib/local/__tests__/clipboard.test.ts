import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";
import { HlcClock } from "../../hlc";
import { newId } from "../../ids";
import { toAscii } from "../../tab/ascii";
import { presetById } from "../../tunings";
import {
  columnRange,
  copyColumns,
  cutColumns,
  deleteColumns,
  pasteClipboard,
  readClipboard,
  writeClipboard,
} from "../clipboard";
import { StablatureDb } from "../db";
import {
  appendNote,
  createBand,
  createPart,
  createSong,
  createTuningFromPreset,
  insertBarline,
  setChord,
  tripletFromTail,
} from "../editing";
import { listAnnotations, listEvents } from "../queries";

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

async function scaffold() {
  const band = await createBand("Hollow Crown", ctx());
  const tuning = await createTuningFromPreset(band.id, bass5, true, ctx());
  const song = await createSong(band.id, "Dirge", tuning.id, ctx());
  const part = await createPart(song, ctx());
  return { band, song, part };
}

/** A part with four distinguishable notes on the E string. */
async function riff() {
  const scaffolded = await scaffold();
  for (const fret of [7, 5, 3, 1]) {
    await appendNote(scaffolded.part, 3, fret, ctx());
  }
  return scaffolded;
}

const eString = async (partId: string) =>
  toAscii({ events: await listEvents(partId, db), tuning: bass5 }).split("\n")[3];

describe("columnRange", () => {
  it("returns the inclusive run between two columns", async () => {
    const { part } = await riff();
    const events = await listEvents(part.id, db);
    expect(columnRange(events, events[1].id, events[2].id).map((e) => e.frets["3"])).toEqual([
      5, 3,
    ]);
  });

  it("does not care which end you tapped first", async () => {
    // Selections are made by tapping two columns, and nobody taps them in
    // order reliably.
    const { part } = await riff();
    const events = await listEvents(part.id, db);
    const forward = columnRange(events, events[0].id, events[2].id);
    const backward = columnRange(events, events[2].id, events[0].id);
    expect(backward).toEqual(forward);
  });

  it("is a single column when both ends are the same", async () => {
    const { part } = await riff();
    const events = await listEvents(part.id, db);
    expect(columnRange(events, events[1].id, events[1].id)).toHaveLength(1);
  });

  it("is empty when an endpoint is gone", async () => {
    const { part } = await riff();
    const events = await listEvents(part.id, db);
    expect(columnRange(events, events[0].id, newId())).toEqual([]);
  });
});

describe("copy and paste", () => {
  it("pastes a run in at the cursor without disturbing anything", async () => {
    const { part } = await riff();
    const events = await listEvents(part.id, db);

    const clipboard = copyColumns(columnRange(events, events[0].id, events[1].id));
    await pasteClipboard(part, events, events[3].id, clipboard, ctx());

    expect(await eString(part.id)).toBe("E |-7-5-3-1-7-5-|");
  });

  it("pastes at the very start", async () => {
    const { part } = await riff();
    const events = await listEvents(part.id, db);

    const clipboard = copyColumns(columnRange(events, events[3].id, events[3].id));
    await pasteClipboard(part, events, null, clipboard, ctx());

    expect(await eString(part.id)).toBe("E |-1-7-5-3-1-|");
  });

  it("pastes into the middle", async () => {
    const { part } = await riff();
    const events = await listEvents(part.id, db);

    const clipboard = copyColumns(columnRange(events, events[0].id, events[0].id));
    await pasteClipboard(part, events, events[1].id, clipboard, ctx());

    expect(await eString(part.id)).toBe("E |-7-5-7-3-1-|");
  });

  it("gives the copies their own identity", async () => {
    const { part } = await riff();
    const events = await listEvents(part.id, db);

    const clipboard = copyColumns(columnRange(events, events[0].id, events[1].id));
    const pasted = await pasteClipboard(part, events, events[3].id, clipboard, ctx());

    const originals = new Set(events.map((e) => e.id));
    // Sharing an id would make editing the copy edit the original.
    expect(pasted.every((row) => !originals.has(row.id))).toBe(true);
  });

  it("leaves the surrounding columns untouched", async () => {
    // Paste is an insert, so nothing around it should be rewritten -- a
    // renumbering would bump clocks and clobber concurrent edits.
    const { part } = await riff();
    const events = await listEvents(part.id, db);
    const clocks = new Map(events.map((e) => [e.id, e.updatedAt]));

    const clipboard = copyColumns(columnRange(events, events[0].id, events[1].id));
    await pasteClipboard(part, events, events[1].id, clipboard, ctx());

    for (const row of await listEvents(part.id, db)) {
      const original = clocks.get(row.id);
      if (original) expect(row.updatedAt).toBe(original);
    }
  });

  it("carries repeats across", async () => {
    const { part } = await scaffold();
    const note = await appendNote(part, 3, 7, ctx());
    await (await import("../editing")).setColumnRepeat(note.id, 4, ctx());

    const events = await listEvents(part.id, db);
    const clipboard = copyColumns(events);
    await pasteClipboard(part, events, events[0].id, clipboard, ctx());

    const after = await listEvents(part.id, db);
    expect(after).toHaveLength(2);
    expect(after.map((e) => e.repeat)).toEqual([4, 4]);
  });

  it("carries barlines across", async () => {
    const { part } = await scaffold();
    await appendNote(part, 3, 7, ctx());
    let events = await listEvents(part.id, db);
    await insertBarline(part, events, events[0].id, ctx());
    events = await listEvents(part.id, db);

    const clipboard = copyColumns(events);
    await pasteClipboard(part, events, events[1].id, clipboard, ctx());

    // Four columns: the copied run carried its trailing barline too.
    expect(await eString(part.id)).toBe("E |-7-|-7-|-|");
  });

  it("gives a pasted triplet its own tuplet, not the original's", async () => {
    const { part } = await scaffold();
    for (let i = 0; i < 3; i += 1) await appendNote(part, 2, 5, ctx());
    await tripletFromTail(part.id, 3, ctx());

    const events = await listEvents(part.id, db);
    const clipboard = copyColumns(events);
    const pasted = await pasteClipboard(part, events, events[2].id, clipboard, ctx());

    const originalTuplet = events[0].tupletId;
    const pastedTuplet = pasted[0].tupletId;
    expect(pastedTuplet).toBeTruthy();
    // Sharing the id would weld the two triplets into one six-column tuplet.
    expect(pastedTuplet).not.toBe(originalTuplet);
    expect(new Set(pasted.map((row) => row.tupletId)).size).toBe(1);
  });

  it("carries chords, re-anchored to the copies", async () => {
    const { part } = await riff();
    const events = await listEvents(part.id, db);
    await setChord(part, events[0].id, "Am", ctx());

    const annotations = await listAnnotations(part.id, db);
    const clipboard = copyColumns(columnRange(events, events[0].id, events[1].id), annotations);
    const pasted = await pasteClipboard(part, events, events[3].id, clipboard, ctx());

    const after = await listAnnotations(part.id, db);
    expect(after).toHaveLength(2);
    const copied = after.find((a) => a.anchorEventId !== events[0].id)!;
    // A dangling anchor would silently drop the chord off the staff.
    expect(copied.anchorEventId).toBe(pasted[0].id);
    expect(copied.value).toBe("Am");
  });

  it("ignores an annotation anchored outside the copied run", async () => {
    const { part } = await riff();
    const events = await listEvents(part.id, db);
    await setChord(part, events[3].id, "C", ctx());

    const annotations = await listAnnotations(part.id, db);
    const clipboard = copyColumns(columnRange(events, events[0].id, events[1].id), annotations);
    expect(clipboard.annotations).toEqual([]);
  });

  it("pastes nothing for an empty clipboard", async () => {
    const { part } = await riff();
    const events = await listEvents(part.id, db);
    expect(
      await pasteClipboard(part, events, null, { columns: [], annotations: [] }, ctx()),
    ).toEqual([]);
  });
});

describe("delete and cut", () => {
  it("removes a whole run", async () => {
    const { part } = await riff();
    const events = await listEvents(part.id, db);

    await deleteColumns(columnRange(events, events[1].id, events[2].id), ctx());

    expect(await eString(part.id)).toBe("E |-7-1-|");
  });

  it("cut copies before it removes", async () => {
    const { part } = await riff();
    const events = await listEvents(part.id, db);

    const clipboard = await cutColumns(
      columnRange(events, events[0].id, events[1].id),
      [],
      ctx(),
    );

    expect(clipboard.columns).toHaveLength(2);
    expect(await eString(part.id)).toBe("E |-3-1-|");

    // And what was cut can come back somewhere else.
    const remaining = await listEvents(part.id, db);
    await pasteClipboard(part, remaining, remaining[1].id, clipboard, ctx());
    expect(await eString(part.id)).toBe("E |-3-1-7-5-|");
  });

  it("deletes as one batch", async () => {
    const { part } = await riff();
    const events = await listEvents(part.id, db);
    const queued = await db.outbox.count();

    await deleteColumns(columnRange(events, events[0].id, events[2].id), ctx());

    // Three tombstones, no partial state in between.
    expect(await db.outbox.count()).toBe(queued + 3);
  });
});

describe("the stored clipboard", () => {
  it("survives being read back, so a copy can cross parts", async () => {
    const { part } = await riff();
    const events = await listEvents(part.id, db);

    await writeClipboard(copyColumns(columnRange(events, events[0].id, events[1].id)), db);

    const restored = await readClipboard(db);
    expect(restored?.columns).toHaveLength(2);
    expect(restored?.columns[0].frets).toEqual({ "3": 7 });
  });

  it("reads as empty when nothing has been copied", async () => {
    expect(await readClipboard(db)).toBeNull();
  });

  it("treats an empty copy as nothing to paste", async () => {
    await writeClipboard({ columns: [], annotations: [] }, db);
    expect(await readClipboard(db)).toBeNull();
  });
});
