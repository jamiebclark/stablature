import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";
import { HlcClock } from "../../hlc";
import { newId } from "../../ids";
import { presetById } from "../../tunings";
import { StablatureDb } from "../db";
import { deleteRow, insertRow } from "../mutate";
import {
  listArrangement,
  listBands,
  listEvents,
  listParts,
  listSongs,
  listTunings,
  listVariants,
  resolveTuning,
} from "../queries";

let db: StablatureDb;
let clock: HlcClock;
let now: number;

beforeEach(async () => {
  db = new StablatureDb(`test-${newId()}`);
  await db.open();
  now = 1_000_000;
  clock = new HlcClock("testnode", () => (now += 1));
});

const ctx = () => ({ db, clock });

const band = (name: string) => insertRow("bands", { id: newId(), name, slug: name.toLowerCase() }, ctx());

const song = (bandId: string, title: string, tuningId: string | null = null) =>
  insertRow("songs", { id: newId(), bandId, title, tuningId, bpm: null, notes: null }, ctx());

const tuning = (bandId: string, name: string, presetId: string, isDefault: boolean) =>
  insertRow(
    "tunings",
    { id: newId(), bandId, name, strings: presetById(presetId)!.strings, isDefault },
    ctx(),
  );

const part = (
  bandId: string,
  songId: string,
  label: string,
  rank: string,
  variantOfPartId: string | null = null,
) =>
  insertRow(
    "parts",
    { id: newId(), bandId, songId, label, name: null, rank, variantOfPartId, notes: null },
    ctx(),
  );

const column = (bandId: string, partId: string, rank: string, fret: number) =>
  insertRow(
    "events",
    {
      id: newId(),
      bandId,
      partId,
      rank,
      kind: "notes" as const,
      frets: { "3": fret },
      techniques: {},
      repeat: 1,
      durationHint: null,
      tupletId: null,
      tupletCount: null,
    },
    ctx(),
  );

describe("tombstones", () => {
  it("are hidden from every list query", async () => {
    const b = await band("Hollow Crown");
    const keep = await song(b.id, "Keep");
    const drop = await song(b.id, "Drop");

    await deleteRow("songs", drop.id, ctx());

    const titles = (await listSongs(b.id, db)).map((s) => s.title);
    expect(titles).toEqual(["Keep"]);
    // Still physically present, because deletes have to be mergeable.
    expect(await db.songs.get(drop.id)).toBeDefined();
    expect(keep.deletedAt).toBeNull();
  });

  it("are hidden from band lists too", async () => {
    const b = await band("Gone");
    await deleteRow("bands", b.id, ctx());
    expect(await listBands(db)).toEqual([]);
  });
});

describe("ordering", () => {
  it("returns parts and columns in rank order, not insertion order", async () => {
    const b = await band("B");
    const s = await song(b.id, "S");

    // Inserted out of order on purpose.
    await part(b.id, s.id, "C", "a3");
    await part(b.id, s.id, "A", "a1");
    await part(b.id, s.id, "B", "a2");

    expect((await listParts(s.id, db)).map((p) => p.label)).toEqual(["A", "B", "C"]);
  });

  it("sorts ranks by codepoint, so an uppercase key precedes a lowercase one", async () => {
    const b = await band("B");
    const s = await song(b.id, "S");
    const p = await part(b.id, s.id, "A", "a0");

    await column(b.id, p.id, "a0", 7);
    await column(b.id, p.id, "Z0", 5);

    // 'Z' < 'a' by codepoint. A locale-aware sort would get this backwards and
    // silently reorder someone's riff.
    expect((await listEvents(p.id, db)).map((e) => e.frets["3"])).toEqual([5, 7]);
  });

  it("lists bands and songs alphabetically", async () => {
    await band("Zealot");
    await band("Altar");
    expect((await listBands(db)).map((b) => b.name)).toEqual(["Altar", "Zealot"]);
  });

  it("returns an empty arrangement for a song with none", async () => {
    const b = await band("B");
    const s = await song(b.id, "S");
    expect(await listArrangement(s.id, db)).toEqual([]);
  });
});

describe("tunings", () => {
  it("puts the default first", async () => {
    const b = await band("B");
    await tuning(b.id, "Drop A", "bass5-drop-a", false);
    await tuning(b.id, "B Standard", "bass5-b", true);
    await tuning(b.id, "A Standard", "bass5-a", false);

    expect((await listTunings(b.id, db)).map((t) => t.name)).toEqual([
      "B Standard",
      "A Standard",
      "Drop A",
    ]);
  });

  it("does not leak another band's tunings", async () => {
    const mine = await band("Mine");
    const theirs = await band("Theirs");
    await tuning(mine.id, "Drop A", "bass5-drop-a", true);
    await tuning(theirs.id, "E Standard", "bass4-e", true);

    expect((await listTunings(mine.id, db)).map((t) => t.name)).toEqual(["Drop A"]);
  });
});

describe("resolveTuning", () => {
  it("prefers the tuning the song names", async () => {
    const b = await band("B");
    await tuning(b.id, "B Standard", "bass5-b", true);
    const dropA = await tuning(b.id, "Drop A", "bass5-drop-a", false);
    const s = await song(b.id, "Heavier", dropA.id);

    expect((await resolveTuning(s, db))!.name).toBe("Drop A");
  });

  it("falls back to the band default when the song names none", async () => {
    const b = await band("B");
    await tuning(b.id, "B Standard", "bass5-b", true);
    await tuning(b.id, "Drop A", "bass5-drop-a", false);
    const s = await song(b.id, "Normal");

    expect((await resolveTuning(s, db))!.name).toBe("B Standard");
  });

  it("falls back again if the named tuning has been deleted", async () => {
    const b = await band("B");
    await tuning(b.id, "B Standard", "bass5-b", true);
    const dropA = await tuning(b.id, "Drop A", "bass5-drop-a", false);
    const s = await song(b.id, "Heavier", dropA.id);

    await deleteRow("tunings", dropA.id, ctx());

    // A dangling tuningId must not leave the song with no tuning at all --
    // the editor cannot render a fretboard without one.
    expect((await resolveTuning(s, db))!.name).toBe("B Standard");
  });

  it("returns undefined when the band has no tunings yet", async () => {
    const b = await band("B");
    const s = await song(b.id, "S");
    expect(await resolveTuning(s, db)).toBeUndefined();
  });
});

describe("listVariants", () => {
  it("finds the variants of a part and nothing else", async () => {
    const b = await band("B");
    const s = await song(b.id, "S");
    const a = await part(b.id, s.id, "A", "a1");
    await part(b.id, s.id, "B", "a2");
    const flourish = await part(b.id, s.id, "A'", "a3", a.id);

    const variants = await listVariants(a.id, s.id, db);
    expect(variants.map((p) => p.id)).toEqual([flourish.id]);
  });
});
