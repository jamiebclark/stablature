import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";
import { HlcClock } from "../../hlc";
import { newId } from "../../ids";
import type { EventRow } from "../../model";
import { pushRequestSchema } from "../../sync/protocol";
import { toAscii } from "../../tab/ascii";
import { readTab } from "../../tab/reading";
import { presetById } from "../../tunings";
import { draftPart } from "../clipboard";
import { StablatureDb } from "../db";
import { createBand, createPart, createSong, createTuningFromPreset } from "../editing";
import { importTab } from "../importing";
import { listAnnotations, listEvents, listParts, listTunings, resolveTuning } from "../queries";
import { barline, bass5, ev } from "../../tab/__tests__/helpers";

let db: StablatureDb;
let now: number;

class FlakyClock extends HlcClock {
  sends = 0;
  constructor(private readonly failAt: number | null) {
    super("testnode", () => (now += 1));
  }
  override send() {
    this.sends += 1;
    if (this.sends === this.failAt) throw new Error("clock failed");
    return super.send();
  }
}

beforeEach(async () => {
  db = new StablatureDb(`test-${newId()}`);
  await db.open();
  now = 1_000_000;
});

async function scaffold(presetId = "bass5-b", parts = 0) {
  const setup = new FlakyClock(null);
  const ctx = { db, clock: setup };
  const band = await createBand("Hollow Crown", ctx);
  const tuning = await createTuningFromPreset(band.id, presetById(presetId)!, true, ctx);
  const song = await createSong(band.id, "Dirge", tuning.id, ctx);
  for (let i = 0; i < parts; i += 1) await createPart(song, ctx);
  return { band, tuning, song };
}

async function contextOf(song: { id: string; bandId: string; tuningId: string | null }) {
  const events = Object.values(
    await (await import("../queries")).listEventsBySong(song.id, db),
  ).flat();
  return {
    tuning: (await resolveTuning(song, db)) ?? null,
    bandTunings: await listTunings(song.bandId, db),
    songEvents: events,
  };
}

async function dump() {
  const tables = [db.bands, db.tunings, db.songs, db.parts, db.events, db.annotations, db.outbox];
  return JSON.stringify(await Promise.all(tables.map((t) => t.toArray())));
}

function boundaryText(): string {
  const events: EventRow[] = [
    ev({ 0: 0, 1: 36 }),
    ev({ 2: 5 }, {}, { repeat: 512 }),
    barline(),
    ev({ 3: 7 }, {}, { repeat: 1 }),
    ev({ 4: "x" }),
  ];
  const group = (from: number, size: number, id: string) => {
    for (const e of events.slice(from, from + size)) {
      e.tupletId = id;
      e.tupletCount = size;
      e.groupKind = "tuplet";
    }
  };
  group(0, 2, "g2");
  return toAscii({ events, tuning: bass5, density: "compact" });
}

describe("importTab (INV-001, INV-021, INV-023, INV-025)", () => {
  it("writes one part whose rows pass the wire schema at the boundaries", async () => {
    const { song } = await scaffold();
    const text = boundaryText();
    const reading = readTab(text, await contextOf({ ...song }));
    expect(reading.kind).toBe("ready");
    if (reading.kind !== "ready") return;

    const result = await importTab(song, text, reading.fitKey, { db, clock: new FlakyClock(null) });
    expect(result.kind).toBe("imported");

    const rows = await db.outbox.toArray();
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200).map((r) => ({ table: r.table, row: r.row }));
      expect(pushRequestSchema.safeParse({ mutations: batch }).success).toBe(true);
    }
  });

  it("stores what the preview drew", async () => {
    const { song } = await scaffold();
    const text = boundaryText();
    const reading = readTab(text, await contextOf({ ...song }));
    if (reading.kind !== "ready") throw new Error("not ready");
    const draft = draftPart(reading.clipboard);
    const result = await importTab(song, text, reading.fitKey, { db, clock: new FlakyClock(null) });
    if (result.kind !== "imported") throw new Error("not imported");
    const stored = {
      events: await listEvents(result.part.id, db),
      annotations: await listAnnotations(result.part.id, db),
    };
    const draw = (rows: typeof draft) =>
      toAscii({ events: rows.events, annotations: rows.annotations, tuning: bass5, density: "compact" });
    expect(draw(stored)).toBe(draw(draft));
  });

  it("a clock that fails on any write leaves rows and outbox untouched", async () => {
    const { song } = await scaffold();
    const text = boundaryText();
    const reading = readTab(text, await contextOf({ ...song }));
    if (reading.kind !== "ready") throw new Error("not ready");

    // Count the sends a good import makes, in a twin store.
    const counter = new FlakyClock(null);
    const twin = await scaffold();
    void twin;
    await importTab(song, text, reading.fitKey, { db, clock: counter });
    const total = counter.sends;
    expect(total).toBeGreaterThan(3);

    for (let n = 1; n <= total; n += 1) {
      const fresh = new StablatureDb(`test-${newId()}`);
      await fresh.open();
      const keep = db;
      db = fresh;
      const again = await scaffold();
      const before = await dump();
      await expect(
        importTab(again.song, text, reading.fitKey, { db, clock: new FlakyClock(n) }),
      ).rejects.toThrow();
      expect(await dump()).toBe(before);
      db = keep;
    }
  });

  it.each([0, 1, 2])("letters the part after %i existing parts, as createPart does", async (count) => {
    const { song } = await scaffold("bass5-b", count);
    const text = toAscii({ events: [ev({ 2: 5 }), ev({ 2: 7 })], tuning: bass5 });
    const reading = readTab(text, await contextOf({ ...song }));
    if (reading.kind !== "ready") throw new Error("not ready");
    const result = await importTab(song, text, reading.fitKey, { db, clock: new FlakyClock(null) });
    if (result.kind !== "imported") throw new Error("not imported");

    const parts = await listParts(song.id, db);
    expect(parts.map((p) => p.label)).toEqual(["A", "B", "C"].slice(0, count + 1));
    expect(result.part.name).toBeNull();
  });

  it("returns changed and writes nothing when the button's promise no longer holds", async () => {
    const { song } = await scaffold();
    const text = toAscii({ events: [ev({ 2: 5 })], tuning: bass5 });
    const before = await dump();
    const result = await importTab(song, text, "preset:bass4-e", { db, clock: new FlakyClock(null) });
    expect(result.kind).toBe("changed");
    expect(await dump()).toBe(before);
  });

  it("switches the song to a preset the band lacks, and imports, in one go", async () => {
    const { song, band } = await scaffold("bass5-b");
    const preset = presetById("bass5-a")!;
    const text = toAscii({ events: [ev({ 2: 5 })], tuning: preset });
    const reading = readTab(text, await contextOf({ ...song }));
    if (reading.kind !== "ready") throw new Error("not ready");
    expect(reading.fitKey).toBe("preset:bass5-a");

    const result = await importTab(song, text, reading.fitKey, { db, clock: new FlakyClock(null) });
    expect(result.kind).toBe("imported");
    const tunings = await listTunings(band.id, db);
    expect(tunings).toHaveLength(2);
    const stored = await db.songs.get(song.id);
    expect(tunings.find((t) => t.id === stored?.tuningId)?.name).toContain("A Standard");
  });
});

describe("a refused paste writes nothing (INV-002, INV-007, INV-008, INV-009)", () => {
  const good = "G |--5--|\nD |-----|\nA |-----|\nE |-----|\nB |-----|";
  const bad = [
    "G |-5s7-|\nD |-----|\nA |-----|\nE |-----|\nB |-----|",
    "G |-57--|\nD |-----|\nA |-----|\nE |-----|\nB |-----|",
    "G |--5--|\nD |--5 7|\nA |-----|\nE |-----|\nB |-----|",
    "T |--5--|\nA |-----|",
    "G |--5--|",
    "lyrics only",
    "G |-----|\nD |-----|",
  ];

  it.each(bad)("refuses %#, and importTab changes nothing", async (text) => {
    const { song } = await scaffold();
    const context = await contextOf({ ...song });
    // no-staff and no-notes only refuse alone: among good lines they are commentary.
    const alone = !text.includes("|") || !/\d/.test(text);
    for (const pasted of alone ? [text] : [text, `${good}\n\n${text}`, `${text}\n\n${good}`]) {
      const reading = readTab(pasted, context);
      expect(reading.kind).toBe("refused");
      const before = await dump();
      const result = await importTab(song, pasted, "preset:bass5-b", {
        db,
        clock: new FlakyClock(null),
      });
      expect(result.kind).toBe("changed");
      expect(await dump()).toBe(before);
    }
  });
});

/** INV-019, INV-020 and INV-023 for an offered tuning. */
describe("importTab with a tuning offer (INV-019, INV-020, INV-023)", () => {
  const a5 = presetById("bass5-a")!;
  const text = toAscii({ events: [ev({ 2: 5 })], tuning: a5 });

  async function offered(song: { id: string; bandId: string; tuningId: string | null }) {
    const reading = readTab(text, await contextOf(song));
    if (reading.kind !== "ready" || reading.fit.kind !== "offer") throw new Error("no offer");
    return reading.fitKey;
  }
  const run = (song: { id: string; bandId: string }, key: string) =>
    importTab(song, text, key, { db, clock: new FlakyClock(null) });

  it.each(["band default set", "null tuningId"])(
    "adds at most one preset-shaped tuning, leaves defaults and other songs alone (%s)",
    async (variant) => {
      const { band, song, tuning } = await scaffold("bass5-b");
      const ctx = { db, clock: new FlakyClock(null) };
      const target = variant === "null tuningId" ? await createSong(band.id, "Null", null, ctx) : song;
      const other = await createSong(band.id, "Other", null, ctx);
      const key = await offered(target);
      const otherBefore = JSON.stringify(await db.songs.get(other.id));
      const outboxBefore = (await db.outbox.toArray()).length;

      const result = await run(target, key);
      expect(result.kind).toBe("imported");
      const tunings = await listTunings(band.id, db);
      expect(tunings).toHaveLength(2);
      const added = tunings.find((t) => t.id !== tuning.id)!;
      expect(added.strings).toEqual(a5.strings);
      expect(added.isDefault).toBe(false);
      expect((await db.tunings.get(tuning.id))?.isDefault).toBe(true);
      expect(JSON.stringify(await db.songs.get(other.id))).toBe(otherBefore);
      const outbox = (await db.outbox.toArray()).slice(outboxBefore);
      expect(outbox.some((o) => o.table === "songs" && o.rowId === other.id)).toBe(false);
      expect((await db.songs.get(target.id))?.tuningId).toBe(added.id);
    },
  );

  it("a band already holding the tuning adds no duplicate", async () => {
    const { band, song } = await scaffold("bass5-b");
    const held = await createTuningFromPreset(band.id, a5, false, { db, clock: new FlakyClock(null) });
    const key = await offered(song);
    expect(key).toBe(`tuning:${held.id}`);
    expect((await run(song, key)).kind).toBe("imported");
    expect(await listTunings(band.id, db)).toHaveLength(2);
    expect((await db.songs.get(song.id))?.tuningId).toBe(held.id);
  });

  describe("the store changes between reading and importing", () => {
    it("a note arrives that the offer would move", async () => {
      const { song } = await scaffold("bass5-b");
      const key = await offered(song);
      const ctx = { db, clock: new FlakyClock(null) };
      const part = await createPart(song, ctx);
      await db.events.put(ev({ 0: 3 }, {}, { partId: part.id, bandId: song.bandId }));
      const before = await dump();
      expect((await run(song, key)).kind).toBe("changed");
      expect(await dump()).toBe(before);
    });

    it("the song's tuning changed", async () => {
      const { song, band } = await scaffold("bass5-b");
      const key = await offered(song);
      const ctx = { db, clock: new FlakyClock(null) };
      const other = await createTuningFromPreset(band.id, a5, false, ctx);
      await (await import("../mutate")).patchRow("songs", song.id, { tuningId: other.id }, ctx);
      const before = await dump();
      expect((await run(song, key)).kind).toBe("changed");
      expect(await dump()).toBe(before);
    });

    it("the band gains the tuning", async () => {
      const { song, band } = await scaffold("bass5-b");
      const key = await offered(song);
      await createTuningFromPreset(band.id, a5, false, { db, clock: new FlakyClock(null) });
      const before = await dump();
      expect((await run(song, key)).kind).toBe("changed");
      expect(await dump()).toBe(before);
    });

    it("the song is deleted", async () => {
      const { song } = await scaffold("bass5-b");
      const key = await offered(song);
      await (await import("../mutate")).deleteRow("songs", song.id, { db, clock: new FlakyClock(null) });
      const before = await dump();
      expect((await run(song, key)).kind).toBe("changed");
      expect(await dump()).toBe(before);
    });

    it("the band's tuning is deleted", async () => {
      const { song, band } = await scaffold("bass5-b");
      const held = await createTuningFromPreset(band.id, a5, false, { db, clock: new FlakyClock(null) });
      const key = await offered(song);
      expect(key).toBe(`tuning:${held.id}`);
      await (await import("../mutate")).deleteRow("tunings", held.id, { db, clock: new FlakyClock(null) });
      const before = await dump();
      expect((await run(song, key)).kind).toBe("changed");
      expect(await dump()).toBe(before);
    });

    it("a new part arriving only moves the letter on", async () => {
      const { song } = await scaffold("bass5-b");
      const key = await offered(song);
      await createPart(song, { db, clock: new FlakyClock(null) });
      const result = await run(song, key);
      expect(result.kind).toBe("imported");
      expect((await listParts(song.id, db)).map((p) => p.label)).toEqual(["A", "B"]);
    });
  });

  it("a failure at any write step rolls the tuning, song and part back together", async () => {
    const { song } = await scaffold("bass5-b");
    const key = await offered(song);
    const counter = new FlakyClock(null);
    const probe = await scaffold("bass5-b");
    await importTab(probe.song, text, key, { db, clock: counter });
    const total = counter.sends;
    expect(total).toBeGreaterThanOrEqual(4);
    const before = await dump();
    for (let n = 1; n <= 4; n += 1) {
      await expect(
        importTab(song, text, key, { db, clock: new FlakyClock(n) }),
      ).rejects.toThrow();
      expect(await dump()).toBe(before);
    }
  });
});
