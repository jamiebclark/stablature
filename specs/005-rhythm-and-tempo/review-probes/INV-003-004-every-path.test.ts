/**
 * INV-003 and INV-004 over the members `rhythm-writes.test.ts` leaves out: `importTab`, a rhythm line
 * in pasted text, `bumpColumnRepeat` by the x4 control, `groupSelection` of both kinds, and a merge
 * against frets, techniques and `tupletCount`, whose test name claims them and whose body has only
 * repeat.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { HlcClock } from "@/lib/hlc";
import { newId } from "@/lib/ids";
import { StablatureDb } from "@/lib/local/db";
import {
  bumpColumnRepeat,
  createBand,
  createPart,
  createSong,
  createTuningFromPreset,
  groupSelection,
  insertNote,
  setColumnDuration,
  stackNote,
} from "@/lib/local/editing";
import { importTab } from "@/lib/local/importing";
import { patchRow } from "@/lib/local/mutate";
import { listEvents, listEventsBySong, listParts, listSongs, listTunings } from "@/lib/local/queries";
import type { DurationHint, EventRow, GroupKind } from "@/lib/model";
import { mergeRow } from "@/lib/sync/merge";
import { readTab } from "@/lib/tab/reading";
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

async function scaffold() {
  const band = await createBand("Hollow Crown", ctx());
  const tuning = await createTuningFromPreset(band.id, presetById("bass5-b")!, true, ctx());
  const song = await createSong(band.id, "Dirge", tuning.id, ctx());
  return { band, tuning, song, part: await createPart(song, ctx()) };
}

const read = async (id: string) => (await db.events.get(id)) as EventRow;

describe("INV-003 importTab", () => {
  for (const [name, rhythm] of [
    ["no rhythm line", null],
    ["a rhythm line above the staff", "   q  q  8 8"],
    ["a rhythm line below the staff", "   w h q 8 16 32"],
  ] as const) {
    it(`writes null on every column, with ${name}`, async () => {
      const { song, tuning } = await scaffold();
      const staff = ["G|--5--7--|", "D|--------|", "A|--------|", "E|--------|", "B|--------|"];
      const lines = rhythm === null ? staff : name.includes("above") ? [rhythm, ...staff] : [...staff, rhythm];
      const text = lines.join("\n");
      const byPart = await listEventsBySong(song.id, db);
      const reading = readTab(text, {
        tuning,
        bandTunings: await listTunings(song.bandId, db),
        songEvents: Object.values(byPart).flat(),
        othersOnNull: false,
      });
      expect(reading.kind, JSON.stringify(reading).slice(0, 300)).toBe("ready");
      if (reading.kind !== "ready") return;
      const result = await importTab(song, text, reading.fitKey, ctx());
      expect(result.kind).toBe("imported");
      const parts = await listParts(song.id, db);
      const rows = await listEvents(parts.at(-1)!.id, db);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.durationHint === null)).toBe(true);
      expect((await listSongs(song.bandId, db)).length).toBe(1);
    });
  }
});

describe("INV-004 other edits leave the value alone", () => {
  for (const d of D) {
    it(`bumpColumnRepeat by 3, both ways, keeps ${d}`, async () => {
      const { part } = await scaffold();
      const a = await insertNote(part, [], null, 3, 5, ctx());
      await setColumnDuration(a.id, d, ctx());
      await bumpColumnRepeat(await read(a.id), 3, ctx());
      expect(await read(a.id)).toMatchObject({ durationHint: d, repeat: 4 });
      await bumpColumnRepeat(await read(a.id), -3, ctx());
      expect(await read(a.id)).toMatchObject({ durationHint: d, repeat: 1 });
    });
  }

  for (const kind of ["tuplet", "plain"] as GroupKind[]) {
    it(`groupSelection ${kind} keeps every duration`, async () => {
      const { part } = await scaffold();
      const cols: EventRow[] = [];
      for (let i = 0; i < 3; i += 1) {
        const e = await insertNote(part, cols, cols.at(-1)?.id ?? null, 3, 5 + i, ctx());
        await setColumnDuration(e.id, "16", ctx());
        cols.push(await read(e.id));
      }
      await groupSelection(part.id, cols[0].id, cols[2].id, kind, ctx());
      const rows = await listEvents(part.id, db);
      expect(rows.every((r) => r.tupletId !== null)).toBe(true);
      expect(rows.map((r) => r.durationHint)).toEqual(["16", "16", "16"]);
    });
  }
});

describe("INV-004 two replicas, both orders", () => {
  const OTHERS: [string, (id: string, row: EventRow) => Record<string, unknown>, (m: EventRow) => void][] = [
    ["repeat", () => ({ repeat: 3 }), (m) => expect(m.repeat).toBe(3)],
    ["frets", () => ({ frets: { "3": 9 } }), (m) => expect(m.frets).toEqual({ "3": 9 })],
    ["techniques", () => ({ techniques: { "3": ["vibrato"] } }), (m) => expect(m.techniques).toEqual({ "3": ["vibrato"] })],
    ["tupletCount", () => ({ tupletCount: 5 }), (m) => expect(m.tupletCount).toBe(5)],
  ];

  for (const [name, patch, check] of OTHERS) {
    it(`a duration against ${name}: both survive`, async () => {
      const { part } = await scaffold();
      const a = await insertNote(part, [], null, 3, 5, ctx());
      const base = await read(a.id);
      await setColumnDuration(a.id, "q", { db, clock: new HlcClock("a", () => 5_000_000) });
      const left = await read(a.id);
      await db.events.put(base);
      await patchRow("events", a.id, patch(a.id, base), { db, clock: new HlcClock("b", () => 6_000_000) });
      const right = await read(a.id);
      for (const merged of [mergeRow("events", left, right), mergeRow("events", right, left)]) {
        expect(merged.durationHint).toBe("q");
        check(merged);
      }
    });
  }

  it("stacking a note on another replica keeps the duration", async () => {
    const { part } = await scaffold();
    const a = await insertNote(part, [], null, 3, 5, ctx());
    await setColumnDuration(a.id, "8", ctx());
    const stacked = await stackNote(await read(a.id), 2, 7, ctx());
    expect(stacked.durationHint).toBe("8");
  });
});
