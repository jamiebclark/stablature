import "fake-indexeddb/auto";

/**
 * INV-019/021: a fresh variant and a pasted copy both read as the parent, whatever ids they were given.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { HlcClock } from "@/lib/hlc";
import { newId } from "@/lib/ids";
import { copyColumns, pasteClipboard } from "@/lib/local/clipboard";
import { StablatureDb } from "@/lib/local/db";
import {
  appendNote,
  createBand,
  createPart,
  createSong,
  createTuningFromPreset,
  createVariant,
  insertBarline,
  setChord,
} from "@/lib/local/editing";
import { listAnnotations, listEvents, listSongContent } from "@/lib/local/queries";
import { compareParts, compareVariants } from "@/lib/reading/compare";
import { presetById } from "@/lib/tunings";

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

async function parent() {
  const band = await createBand("Hollow Crown", ctx());
  const tuning = await createTuningFromPreset(band.id, bass5, true, ctx());
  const song = await createSong(band.id, "Dirge", tuning.id, ctx());
  const part = await createPart(song, ctx());
  for (const fret of [7, 5]) await appendNote(part, 3, fret, ctx());
  const before = await listEvents(part.id, db);
  await insertBarline(part, before, before[before.length - 1].id, ctx());
  await appendNote(part, 3, 3, ctx());
  const events = await listEvents(part.id, db);
  expect(events.map((e) => e.kind)).toContain("barline");
  await setChord(part, events[0].id, "Am", ctx());
  return { tuning, song, part };
}

describe("copies of a part", () => {
  it("a fresh variant says nothing changed", async () => {
    const { tuning, song, part } = await parent();
    await createVariant(part, ctx());
    const comparisons = compareVariants(await listSongContent(song.id, db), tuning);
    expect(comparisons.size).toBe(1);
    expect([...comparisons.values()][0].ops.every((op) => op.kind === "same")).toBe(true);
  });

  it("a pasted copy equals its parent", async () => {
    const { tuning, song, part } = await parent();
    const events = await listEvents(part.id, db);
    const annotations = await listAnnotations(part.id, db);
    const target = await createPart(song, ctx());
    await pasteClipboard(target, [], null, copyColumns(events, annotations), ctx());
    const result = compareParts(
      { part, events, annotations },
      { part: target, events: await listEvents(target.id, db), annotations: await listAnnotations(target.id, db) },
      tuning.strings.length,
    );
    expect(result.ops.every((op) => op.kind === "same")).toBe(true);
    expect(result.ops.length).toBe(events.length);
  });
});
