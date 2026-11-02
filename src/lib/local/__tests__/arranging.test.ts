import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";
import {
  describeArrangement,
  expandArrangement,
  parseArrangement,
} from "../../arrangement/expand";
import { HlcClock } from "../../hlc";
import { newId } from "../../ids";
import { presetById } from "../../tunings";
import {
  appendPartEntry,
  appendSection,
  appendTextEntry,
  bumpEntryRepeat,
  deleteSection,
  moveEntry,
  seedArrangementFromParts,
  setEntryBars,
  setEntryVariant,
} from "../arranging";
import { StablatureDb } from "../db";
import {
  appendBarline,
  appendNote,
  createBand,
  createPart,
  createSong,
  createTuningFromPreset,
  createVariant,
} from "../editing";
import { listArrangement, listParts } from "../queries";

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
  const tuning = await createTuningFromPreset(band.id, presetById("bass5-b")!, true, ctx());
  const song = await createSong(band.id, "Dirge", tuning.id, ctx());
  const a = await createPart(song, ctx());
  const b = await createPart(song, ctx());
  const c = await createPart(song, ctx());
  return { band, tuning, song, a, b, c };
}

/** The compact notation, read back out of the database. */
async function notation(songId: string) {
  const entries = await listArrangement(songId, db);
  const parts = await listParts(songId, db);
  return describeArrangement(parseArrangement(entries), parts);
}

async function passes(songId: string) {
  const entries = await listArrangement(songId, db);
  const parts = await listParts(songId, db);
  return expandArrangement(parseArrangement(entries)).map(
    (step) => parts.find((p) => p.id === step.partId)!.label,
  );
}

describe("building the brief's arrangement", () => {
  it("assembles A x4, B, A x4 with a flourish on the 4th, B", async () => {
    const { song, a, b } = await scaffold();
    await appendNote(a, 3, 7, ctx());
    const flourish = await createVariant(a, ctx());

    const first = await appendPartEntry(song, a.id, { repeat: 4 }, ctx());
    await appendPartEntry(song, b.id, {}, ctx());
    const third = await appendPartEntry(song, a.id, { repeat: 4 }, ctx());
    await setEntryVariant(third.id, flourish.id, ctx());
    await appendPartEntry(song, b.id, {}, ctx());

    expect(await notation(song.id)).toBe("Ax4  B  Ax4 (4th: A')  B");
    expect(await passes(song.id)).toEqual([
      "A", "A", "A", "A",
      "B",
      "A", "A", "A", "A'",
      "B",
    ]);
    expect(first.repeat).toBe(4);
  });

  it("plays half of a part", async () => {
    const { song, c } = await scaffold();
    // Two bars of C, so "first half" means something.
    await appendNote(c, 3, 7, ctx());
    await appendBarline(c, ctx());
    await appendNote(c, 3, 5, ctx());

    const entry = await appendPartEntry(song, c.id, {}, ctx());
    await setEntryBars(entry.id, 1, 1, ctx());

    expect(await notation(song.id)).toBe("C bar 1");
  });

  it("normalises a reversed bar range instead of rejecting it", async () => {
    const { song, c } = await scaffold();
    const entry = await appendPartEntry(song, c.id, {}, ctx());
    await setEntryBars(entry.id, 4, 2, ctx());
    expect(await notation(song.id)).toBe("C bars 2-4");
  });
});

describe("repeats", () => {
  it("bumps without dropping below one", async () => {
    const { song, a } = await scaffold();
    const entry = await appendPartEntry(song, a.id, {}, ctx());

    await bumpEntryRepeat(entry, 3, ctx());
    expect(await notation(song.id)).toBe("Ax4");

    await bumpEntryRepeat({ id: entry.id, repeat: 4 }, -99, ctx());
    expect(await notation(song.id)).toBe("A");
  });
});

describe("sections", () => {
  it("writes a matched start/end pair", async () => {
    const { song } = await scaffold();
    await appendSection(song, "Chorus", 2, ctx());

    const entries = await listArrangement(song.id, db);
    expect(entries.map((e) => e.kind)).toEqual(["section_start", "section_end"]);
    // Order matters: reversed markers would parse as an empty stray section.
    expect(entries[0].label).toBe("Chorus");
  });

  it("repeats the parts added inside it", async () => {
    const { song, a, b } = await scaffold();
    await appendSection(song, "Chorus", 2, ctx());

    // A part appended after the pair lands outside, which is why the editor
    // inserts into a section rather than appending.
    await appendPartEntry(song, a.id, {}, ctx());
    expect(await passes(song.id)).toEqual(["A"]);

    // Move it between the markers to put it inside.
    const entries = await listArrangement(song.id, db);
    const added = entries.find((e) => e.partId === a.id)!;
    await moveEntry(entries, added.id, 1, ctx());

    expect(await passes(song.id)).toEqual(["A", "A"]);
    await appendPartEntry(song, b.id, {}, ctx());
    expect(await passes(song.id)).toEqual(["A", "A", "B"]);
  });

  it("deletes a section with its own end marker, not the nearest one", async () => {
    const { song } = await scaffold();
    await appendSection(song, "Outer", 2, ctx());

    let entries = await listArrangement(song.id, db);
    const outerStart = entries[0];

    // Nest a second section inside the first.
    await appendSection(song, "Inner", 3, ctx());
    entries = await listArrangement(song.id, db);
    const innerStart = entries.find((e) => e.label === "Inner")!;
    const innerEnd = entries[entries.length - 1];
    await moveEntry(entries, innerStart.id, 1, ctx());
    entries = await listArrangement(song.id, db);
    await moveEntry(entries, innerEnd.id, 2, ctx());

    entries = await listArrangement(song.id, db);
    expect(entries.map((e) => e.label)).toEqual(["Outer", "Inner", null, null]);

    await deleteSection(entries, outerStart.id, ctx());

    const after = await listArrangement(song.id, db);
    // The inner section must survive intact.
    expect(after.map((e) => e.kind)).toEqual(["section_start", "section_end"]);
    expect(after[0].label).toBe("Inner");
  });

  it("is a no-op when deleting an entry that is gone", async () => {
    const { song } = await scaffold();
    await appendSection(song, "Chorus", 2, ctx());
    const entries = await listArrangement(song.id, db);
    await deleteSection(entries, newId(), ctx());
    expect(await listArrangement(song.id, db)).toHaveLength(2);
  });
});

describe("moveEntry", () => {
  it("reorders by writing only the moved row", async () => {
    const { song, a, b, c } = await scaffold();
    await appendPartEntry(song, a.id, {}, ctx());
    await appendPartEntry(song, b.id, {}, ctx());
    await appendPartEntry(song, c.id, {}, ctx());

    const entries = await listArrangement(song.id, db);
    const before = entries.map((e) => e.updatedAt);

    await moveEntry(entries, entries[2].id, 0, ctx());

    expect(await passes(song.id)).toEqual(["C", "A", "B"]);
    const after = await listArrangement(song.id, db);
    // The two untouched rows keep their original clocks, so a concurrent edit
    // to either of them still wins.
    const unchanged = after.filter((e) => before.includes(e.updatedAt));
    expect(unchanged).toHaveLength(2);
  });

  it("writes nothing when the move changes nothing", async () => {
    const { song, a, b } = await scaffold();
    await appendPartEntry(song, a.id, {}, ctx());
    await appendPartEntry(song, b.id, {}, ctx());

    const entries = await listArrangement(song.id, db);
    const queued = await db.outbox.count();
    await moveEntry(entries, entries[0].id, 0, ctx());

    expect(await db.outbox.count()).toBe(queued);
  });

  it("clamps an out-of-range target", async () => {
    const { song, a, b } = await scaffold();
    await appendPartEntry(song, a.id, {}, ctx());
    await appendPartEntry(song, b.id, {}, ctx());
    const entries = await listArrangement(song.id, db);

    await moveEntry(entries, entries[0].id, 99, ctx());
    expect(await passes(song.id)).toEqual(["B", "A"]);
  });
});

describe("text cues", () => {
  it("records a cue and keeps it out of the playable sequence", async () => {
    const { song, a } = await scaffold();
    await appendPartEntry(song, a.id, {}, ctx());
    await appendTextEntry(song, "  build slowly  ", ctx());

    expect(await notation(song.id)).toBe('A  "build slowly"');
    expect(await passes(song.id)).toEqual(["A"]);
  });

  it("ignores an empty cue", async () => {
    const { song } = await scaffold();
    expect(await appendTextEntry(song, "   ", ctx())).toBeUndefined();
    expect(await listArrangement(song.id, db)).toHaveLength(0);
  });
});

describe("seedArrangementFromParts", () => {
  it("adds each part once, in order", async () => {
    const { song } = await scaffold();
    await seedArrangementFromParts(song, await listParts(song.id, db), ctx());
    expect(await notation(song.id)).toBe("A  B  C");
  });

  it("leaves variants out, since they are reached through a repeat", async () => {
    const { song, a } = await scaffold();
    await createVariant(a, ctx());

    await seedArrangementFromParts(song, await listParts(song.id, db), ctx());
    expect(await notation(song.id)).toBe("A  B  C");
  });

  it("does nothing for a song with no parts", async () => {
    const { band, tuning } = await scaffold();
    const empty = await createSong(band.id, "Empty", tuning.id, ctx());
    await seedArrangementFromParts(empty, [], ctx());
    expect(await listArrangement(empty.id, db)).toHaveLength(0);
  });
});
