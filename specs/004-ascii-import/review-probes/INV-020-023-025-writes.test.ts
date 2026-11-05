/**
 * INV-020: never does the write act on a reading the store no longer supports.
 * INV-023: never is an import left half done.
 * INV-025: never does an import touch what exists, or letter or place a part differently from `+ part`.
 * INV-022 (unit half): reading and drafting touch no database.
 */
import { describe, expect, it, vi } from "vitest";
import { draftPart } from "@/lib/local/clipboard";
import { createPart, createTuningFromPreset, createVariant } from "@/lib/local/editing";
import { importTab } from "@/lib/local/importing";
import { deleteRow, insertRow, patchRow } from "@/lib/local/mutate";
import { listParts, listTunings } from "@/lib/local/queries";
import { newId } from "@/lib/ids";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";
import { Clock, dump, eventsOf, four, holdNotes, imported, reading, staff, world, type World } from "./unit-helpers";

const FIVE = staff("GDAEB", ["-5-", "---", "---", "---", "-3-"]);
const A5 = staff("FCGDA", ["-5-", "---", "---", "---", "-3-"]);
const RICH = `    Am\n    ,-3-,\n${four("-5-7-9-")}`;

/** A world per member of F, and the text that takes that path. */
const F: [string, () => Promise<World>, string][] = [
  ["fits", () => world("bass4-e"), RICH],
  [
    "offer of a band tuning",
    async () => {
      const w = await world("bass4-e");
      await createTuningFromPreset(w.bandId, presetById("bass5-b")!, false, w.ctx);
      return w;
    },
    `    Am\n    ,-3-,\n${staff("GDAEB", ["-5-7-9-", "-------", "-------", "-------", "-3-----"])}`,
  ],
  [
    "offer of a preset the band lacks",
    () => world("bass4-e"),
    `    Am\n    ,-3-,\n${staff("GDAEB", ["-5-7-9-", "-------", "-------", "-------", "-3-----"])}`,
  ],
];

describe("INV-023 a failure at any write leaves nothing", () => {
  it.each(F)("%s, failing at every N", async (_name, make, text) => {
    const probe = await make();
    const r = await reading(probe, text);
    if (r.kind !== "ready") throw new Error("not ready");
    const counter = new Clock();
    await importTab(probe.song, text, r.fitKey, { db: probe.db, clock: counter });
    expect(counter.sends).toBeGreaterThan(4);

    for (let n = 1; n <= counter.sends; n += 1) {
      const w = await make();
      const key = (await reading(w, text)) as Extract<typeof r, { kind: "ready" }>;
      const before = await dump(w);
      await expect(
        importTab(w.song, text, key.fitKey, { db: w.db, clock: new Clock(n) }),
        `N=${n}`,
      ).rejects.toThrow();
      expect(await dump(w), `N=${n}`).toBe(before);
    }
  });
});

describe("INV-020 the store moves between the read and the write", () => {
  async function offered() {
    const w = await world("bass4-e");
    const r = await reading(w, FIVE);
    if (r.kind !== "ready") throw new Error("not ready");
    return { w, key: r.fitKey };
  }

  it("a note arrives that the offer would change", async () => {
    const w = await world("bass5-b");
    const r = await reading(w, A5);
    if (r.kind !== "ready") throw new Error("not ready");
    await holdNotes(w, [0]);
    const before = await dump(w);
    expect((await importTab(w.song, A5, r.fitKey, w.ctx)).kind).toBe("changed");
    expect(await dump(w)).toBe(before);
  });

  it("the song's tuning changes", async () => {
    const { w, key } = await offered();
    const other = await createTuningFromPreset(w.bandId, presetById("bass5-b")!, false, w.ctx);
    await patchRow("songs", w.song.id, { tuningId: other.id }, w.ctx);
    const before = await dump(w);
    expect((await importTab(w.song, FIVE, key, w.ctx)).kind).toBe("changed");
    expect(await dump(w)).toBe(before);
  });

  it("the band gains the tuning, so the key differs", async () => {
    const { w, key } = await offered();
    await createTuningFromPreset(w.bandId, presetById("bass5-b")!, false, w.ctx);
    const before = await dump(w);
    expect((await importTab(w.song, FIVE, key, w.ctx)).kind).toBe("changed");
    expect(await dump(w)).toBe(before);
  });

  it("the song is deleted", async () => {
    const { w, key } = await offered();
    await deleteRow("songs", w.song.id, w.ctx);
    const before = await dump(w);
    expect((await importTab(w.song, FIVE, key, w.ctx)).kind).toBe("changed");
    expect(await dump(w)).toBe(before);
  });

  it("the band's tuning is deleted", async () => {
    const w = await world("bass4-e");
    const held = await createTuningFromPreset(w.bandId, presetById("bass5-b")!, false, w.ctx);
    const r = await reading(w, FIVE);
    if (r.kind !== "ready") throw new Error("not ready");
    expect(r.fitKey).toBe(`tuning:${held.id}`);
    await deleteRow("tunings", held.id, w.ctx);
    const before = await dump(w);
    expect((await importTab(w.song, FIVE, r.fitKey, w.ctx)).kind).toBe("changed");
    expect(await dump(w)).toBe(before);
  });

  it("a new part arriving is not a change: the letter moves on", async () => {
    const { w, key } = await offered();
    await createPart(w.song, w.ctx);
    const out = await importTab(w.song, FIVE, key, w.ctx);
    expect(out.kind === "imported" && out.part.label).toBe("B");
  });
});

describe("INV-025 the same letter and place as + part", () => {
  async function arrange(w: World, shape: string) {
    const made = [];
    if (shape === "0 parts") return;
    made.push(await createPart(w.song, w.ctx));
    if (shape === "1 part") return;
    made.push(await createPart(w.song, w.ctx));
    if (shape === "2 parts") return;
    if (shape === "a variant") {
      await createVariant(made[0], w.ctx);
      return;
    }
    if (shape === "a deleted part's letter") {
      await deleteRow("parts", made[0].id, w.ctx);
      return;
    }
    if (shape === "26 parts") {
      for (let i = 2; i < 26; i += 1) await createPart(w.song, w.ctx);
    }
  }

  const SHAPES = ["0 parts", "1 part", "2 parts", "a variant", "a deleted part's letter", "26 parts"];

  for (const [name, make, text] of F) {
    it.each(SHAPES)(`${name}: %s`, async (shape) => {
      const w = await make();
      await arrange(w, shape);
      const twin = await make();
      await arrange(twin, shape);
      const expected = await createPart(twin.song, twin.ctx);

      const existing = JSON.stringify([
        await w.db.parts.toArray(),
        await w.db.events.toArray(),
        await w.db.annotations.toArray(),
      ]);
      const outbox = await w.db.outbox.count();
      const { part } = await imported(w, text);

      expect(part.label).toBe(expected.label);
      expect(part.rank).toBe(expected.rank);
      expect(part.name).toBeNull();
      expect(part.variantOfPartId).toBeNull();
      const parts = await listParts(w.song.id, w.db);
      expect(parts[parts.length - 1].id).toBe(part.id);

      const [p, e, a] = JSON.parse(existing) as { id: string }[][];
      for (const [table, rows] of [["parts", p], ["events", e], ["annotations", a]] as const) {
        const now = new Map(
          (await (w.db[table] as { toArray(): Promise<{ id: string }[]> }).toArray()).map((r) => [r.id, r]),
        );
        for (const row of rows) expect(now.get(row.id)).toEqual(row);
      }
      const fresh = (await w.db.outbox.toArray()).slice(outbox);
      for (const o of fresh) {
        if (o.table === "parts") expect(o.rowId).toBe(part.id);
        if (o.table === "events" || o.table === "annotations") {
          expect((o.row as { partId: string }).partId).toBe(part.id);
        }
      }

      const events = await eventsOf(w, part.id);
      const ranks = events.map((x) => x.rank);
      expect([...ranks].sort()).toEqual(ranks);
      expect(new Set(ranks).size).toBe(ranks.length);
      for (const x of events) expect(x.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    });
  }

  it("arrangement entries with bar ranges are untouched", async () => {
    const w = await world("bass4-e");
    const part = await createPart(w.song, w.ctx);
    await insertRow(
      "arrangementEntries",
      {
        id: newId(),
        bandId: w.bandId,
        songId: w.song.id,
        rank: "a0",
        kind: "part",
        partId: part.id,
        repeat: 2,
        fromBar: 1,
        toBar: 2,
        lastRepeatPartId: null,
        label: null,
      },
      w.ctx,
    );
    const before = JSON.stringify(await w.db.arrangementEntries.toArray());
    const count = await w.db.outbox.count();
    await imported(w, RICH);
    expect(JSON.stringify(await w.db.arrangementEntries.toArray())).toBe(before);
    const fresh = (await w.db.outbox.toArray()).slice(count);
    expect(fresh.some((o) => o.table === "arrangementEntries")).toBe(false);
  });
});

describe("INV-022 reading and drafting write nothing", () => {
  it("run with a database whose every write throws", async () => {
    const w = await world("bass4-e");
    const before = await dump(w);
    const context = {
      tuning: presetById("bass4-e")!,
      bandTunings: await listTunings(w.bandId, w.db),
      songEvents: [],
    };
    const spies = (["events", "parts", "annotations", "songs", "tunings", "outbox"] as const).flatMap((t) => [
      vi.spyOn(w.db[t], "put").mockImplementation(() => {
        throw new Error("a write");
      }),
      vi.spyOn(w.db[t], "add").mockImplementation(() => {
        throw new Error("a write");
      }),
    ]);
    const r = readTab(RICH, context);
    expect(r.kind).toBe("ready");
    if (r.kind === "ready") draftPart(r.clipboard);
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
    expect(await dump(w)).toBe(before);
  });
});
