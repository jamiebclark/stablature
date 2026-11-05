// @vitest-environment jsdom
import "fake-indexeddb/auto";
/**
 * Round 2. The tests T070 overwrote in `rhythm-writes.test.ts`, rebuilt from the text the round 1
 * review printed (`.pipeline/review.result.json`), and widened to each of D where the plan says so.
 * Round 1 recorded INV-003 and INV-004 as held on the strength of these, so they are the evidence
 * those rows need. `INV-003-004-every-path.test.ts` covered only what they left out.
 *
 * `run-mutants.sh` measures them: every write mutant survives the whole unit suite and dies here.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { HlcClock } from "@/lib/hlc";
import { newId } from "@/lib/ids";
import { copyColumns, cutColumns, pasteClipboard } from "@/lib/local/clipboard";
import { StablatureDb } from "@/lib/local/db";
import {
  appendBarline,
  appendNote,
  bumpColumnRepeat,
  createBand,
  createPart,
  createSong,
  createTuningFromPreset,
  createVariant,
  groupRunEndingAt,
  groupSelection,
  insertBarline,
  insertNote,
  insertRest,
  setChord,
  setColumnDuration,
  setSongTempo,
  stackNote,
  toggleDecoration,
  ungroupTuplet,
  unstackNote,
} from "@/lib/local/editing";
import { listEvents } from "@/lib/local/queries";
import type { DurationHint, EventRow } from "@/lib/model";
import { presetById } from "@/lib/tunings";

const D: DurationHint[] = ["w", "h", "q", "8", "16", "32"];

let db: StablatureDb;
let clock: HlcClock;

beforeEach(async () => {
  db = new StablatureDb(`probe-${newId()}`);
  await db.open();
  let now = 1_000_000;
  clock = new HlcClock("probe", () => (now += 1));
});

const ctx = () => ({ db, clock });
const read = async (id: string) => (await db.events.get(id)) as EventRow;
const clocks = (row: EventRow) => row.fieldClocks as Record<string, unknown>;

async function scaffold() {
  const band = await createBand("Hollow Crown", ctx());
  const tuning = await createTuningFromPreset(band.id, presetById("bass5-b")!, true, ctx());
  const song = await createSong(band.id, "Dirge", tuning.id, ctx());
  return { song, part: await createPart(song, ctx()) };
}

describe("setColumnDuration", () => {
  it("writes only durationHint and moves only that clock", async () => {
    const { part } = await scaffold();
    for (const d of [...D, null]) {
      const a = await insertNote(part, [], null, 3, 5, ctx());
      await bumpColumnRepeat(await read(a.id), 2, ctx());
      const before = await read(a.id);
      await setColumnDuration(a.id, d, ctx());
      const after = await read(a.id);
      expect(after.durationHint).toBe(d);
      expect(after).toMatchObject({ frets: before.frets, repeat: before.repeat, kind: before.kind });
      const moved = Object.keys(clocks(after)).filter((k) => clocks(after)[k] !== clocks(before)[k]);
      expect(moved).toEqual(["durationHint"]);
    }
  });
});

describe("INV-003 a neighbour's duration is never inherited", () => {
  for (const d of D) {
    it(`insert and append routes write null beside ${d}`, async () => {
      const { part } = await scaffold();
      const a = await insertNote(part, [], null, 3, 5, ctx());
      await setColumnDuration(a.id, d, ctx());
      const a2 = await read(a.id);
      const rows = [
        await insertNote(part, [a2], a.id, 3, 7, ctx()),
        await insertRest(part, [a2], a.id, ctx()),
        await insertBarline(part, [a2], a.id, ctx()),
      ];
      for (const r of rows) expect(r.durationHint).toBeNull();
      const { part: other } = await scaffold();
      const b = await appendNote(other, 2, 3, ctx());
      await setColumnDuration(b.id, d, ctx());
      expect((await appendNote(other, 2, 4, ctx())).durationHint).toBeNull();
      const c = await appendNote(other, 2, 5, ctx());
      await setColumnDuration(c.id, d, ctx());
      expect((await appendBarline(other, ctx())).durationHint).toBeNull();
    });
  }
});

describe("INV-003 a duration travels with copies", () => {
  for (const d of D) {
    it(`copy-paste, cut-paste and createVariant keep ${d}`, async () => {
      const { part } = await scaffold();
      const a = await insertNote(part, [], null, 3, 5, ctx());
      await setColumnDuration(a.id, d, ctx());
      const a2 = await read(a.id);
      const pasted = await pasteClipboard(part, [a2], a.id, copyColumns([a2]), ctx());
      expect(pasted[0].durationHint).toBe(d);

      const all = await listEvents(part.id, db);
      const cut = await cutColumns([all[1]], [], ctx());
      const again = await pasteClipboard(part, await listEvents(part.id, db), a.id, cut, ctx());
      expect(again[0].durationHint).toBe(d);

      const variant = await createVariant(part, ctx());
      const copies = await listEvents(variant.id, db);
      expect(copies.map((e) => e.durationHint)).toEqual(copies.map(() => d));
    });
  }
});

describe("INV-004 other writes leave a duration alone", () => {
  it("repeat, stack, unstack, decoration, chord, grouping", async () => {
    const { part } = await scaffold();
    const cols: EventRow[] = [];
    for (let i = 0; i < 3; i += 1) {
      const e = await insertNote(part, cols, cols.at(-1)?.id ?? null, 3, 5 + i, ctx());
      await setColumnDuration(e.id, "16", ctx());
      cols.push(await read(e.id));
    }
    const dur = async () => (await listEvents(part.id, db)).map((e) => e.durationHint);
    await bumpColumnRepeat(cols[0], 1, ctx());
    await bumpColumnRepeat(cols[0], -1, ctx());
    const stacked = await stackNote(await read(cols[1].id), 2, 7, ctx());
    await unstackNote(stacked, 2, ctx());
    await toggleDecoration(cols[1].id, 3, "vibrato", ctx());
    await setChord(part, cols[0].id, "Am", ctx());
    expect(await dur()).toEqual(["16", "16", "16"]);
    await groupSelection(part.id, cols[0].id, cols[2].id, "tuplet", ctx());
    await ungroupTuplet(await listEvents(part.id, db), ctx());
    await groupRunEndingAt(part.id, null, 3, ctx());
    expect(await dur()).toEqual(["16", "16", "16"]);
  });
});

describe("INV-015 setSongTempo", () => {
  it("writes once for a new value, never for the stored one", async () => {
    const { song } = await scaffold();
    const n0 = await db.outbox.count();
    expect(await setSongTempo(song.id, 118, ctx())).toBe(true);
    expect(await db.outbox.count()).toBe(n0 + 1);
    expect((await db.songs.get(song.id))?.bpm).toBe(118);
    expect(await setSongTempo(song.id, 118, ctx())).toBe(false);
    expect(await db.outbox.count()).toBe(n0 + 1);
    expect(await setSongTempo(song.id, 90, ctx())).toBe(true);
    expect(await db.outbox.count()).toBe(n0 + 2);
  });
});
