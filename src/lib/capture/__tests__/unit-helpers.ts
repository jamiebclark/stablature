/** Shared world for the spec 003 unit probes: real writes over fake-indexeddb. */
import "fake-indexeddb/auto";

import { expect } from "vitest";
import { HlcClock } from "@/lib/hlc";
import { newId } from "@/lib/ids";
import { StablatureDb } from "@/lib/local/db";
import {
  appendBarline,
  appendNote,
  createBand,
  createPart,
  createSong,
  createTuningFromPreset,
  groupRunEndingAt,
  groupSelection,
  insertRest,
  tripletFromTail,
  ungroupTuplet,
} from "@/lib/local/editing";
import { listEvents } from "@/lib/local/queries";
import type { EventRow, PartRow, SongRow } from "@/lib/model";
import { pushRequestSchema } from "@/lib/sync/protocol";
import { presetById } from "@/lib/tunings";

export const bass5 = presetById("bass5-b")!;
/** src/lib/sync/client.ts:27. Not exported, so restated here. */
export const PUSH_BATCH = 200;

export interface World {
  db: StablatureDb;
  clock: HlcClock;
  ctx: { db: StablatureDb; clock: HlcClock };
  song: SongRow;
  part: PartRow;
}

export async function world(node = "probe", start = 1_000_000): Promise<World> {
  const db = new StablatureDb(`probe-${newId()}`);
  await db.open();
  let now = start;
  const clock = new HlcClock(node, () => (now += 1));
  const ctx = { db, clock };
  const band = await createBand("Hollow Crown", ctx);
  const tuning = await createTuningFromPreset(band.id, bass5, true, ctx);
  const song = await createSong(band.id, "Dirge", tuning.id, ctx);
  const part = await createPart(song, ctx);
  return { db, clock, ctx, song, part };
}

/** "n" a note, "r" a real rest, "|" a barline. */
export async function build(w: World, shape: string, part: PartRow = w.part): Promise<EventRow[]> {
  for (const ch of shape) {
    if (ch === "n") await appendNote(part, 3, 5, w.ctx);
    else if (ch === "|") await appendBarline(part, w.ctx);
    else {
      const existing = await listEvents(part.id, w.db);
      await insertRest(part, existing, existing.at(-1)?.id ?? null, w.ctx);
    }
  }
  return listEvents(part.id, w.db);
}

export const rows = (w: World, part: PartRow = w.part) => listEvents(part.id, w.db);

/** The six barline shapes of INV-001, for `n` playable columns. */
export function shapes(n: number): Record<string, string> {
  const notes = (k: number) => "n".repeat(k);
  const half = Math.floor(n / 2);
  const third = Math.max(1, Math.floor(n / 3));
  return {
    "no barline": notes(n),
    "left edge": `|${notes(n)}`,
    "right edge": `${notes(n)}|`,
    "both edges": `|${notes(n)}|`,
    "one interior": `${notes(half)}|${notes(n - half)}`,
    "two interior":
      n >= 3
        ? `${notes(third)}|${notes(third)}|${notes(n - 2 * third)}`
        : `${notes(1)}||${notes(n - 1)}`,
  };
}

/** Every outbox row, wrapped as the client wraps it, in the client's batches, through the real schema. */
export async function expectOutboxPushes(w: World): Promise<number> {
  const entries = await w.db.outbox.orderBy("seq").toArray();
  for (let i = 0; i < entries.length; i += PUSH_BATCH) {
    const mutations = entries.slice(i, i + PUSH_BATCH).map((e) => ({ table: e.table, row: e.row }));
    const parsed = pushRequestSchema.safeParse({ mutations });
    if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues.slice(0, 3)));
  }
  return entries.length;
}

export const triple = (r: EventRow) => ({
  tupletId: r.tupletId,
  tupletCount: r.tupletCount,
  groupKind: r.groupKind,
});
export const NONE = { tupletId: null, tupletCount: null, groupKind: null };

/** One of the three written states of FR-002, with strict nulls. */
export function expectWrittenState(r: EventRow) {
  if (r.tupletId === null) {
    expect(triple(r)).toEqual(NONE);
    return;
  }
  if (r.groupKind === "plain") {
    expect(r.tupletCount).toBeNull();
    return;
  }
  expect(r.groupKind).toBe("tuplet");
  expect(r.tupletCount).toBeGreaterThanOrEqual(2);
  expect(r.tupletCount).toBeLessThanOrEqual(16);
}

export function expectClocksTogether(r: EventRow) {
  expect(r.fieldClocks.tupletCount).toBe(r.fieldClocks.tupletId);
  expect(r.fieldClocks.groupKind).toBe(r.fieldClocks.tupletId);
}

/** Group rows by id within the part: the "group" of the spec's Key Entities. */
export function groups(all: readonly EventRow[]): Map<string, EventRow[]> {
  const out = new Map<string, EventRow[]>();
  for (const r of all) {
    if (!r.tupletId) continue;
    out.set(r.tupletId, [...(out.get(r.tupletId) ?? []), r]);
  }
  return out;
}

/** A row exactly as an older build stored it: no key, and no clock for the field. */
export async function makeLegacy(
  w: World,
  id: string,
  tupletId: string | null,
  tupletCount: number | null,
) {
  const row = (await w.db.events.get(id))!;
  const copy = { ...row, tupletId, tupletCount, fieldClocks: { ...row.fieldClocks } } as EventRow;
  delete (copy as Partial<EventRow>).groupKind;
  delete (copy.fieldClocks as Record<string, string>).groupKind;
  await w.db.events.put(copy);
  return copy;
}

export type Actor = (c: {
  partId: string;
  rows: readonly EventRow[];
  ctx: World["ctx"];
}) => Promise<unknown>;

/**
 * The set A of the plan, over five notes whose first three are an old group: each grouping action
 * takes columns 2 to 4, so columns 0 and 1 are dissolved. The sheet's commit is
 * `ungroupTuplet([ctx.event])` (src/lib/capture/properties.ts:147) and takes no ctx, so here it is
 * that same call with one column.
 */
export const SET_A: Record<string, Actor> = {
  "tuplet control": ({ partId, rows: r, ctx }) =>
    groupSelection(partId, r[2].id, r[4].id, "tuplet", ctx),
  "group control": ({ partId, rows: r, ctx }) =>
    groupSelection(partId, r[2].id, r[4].id, "plain", ctx),
  "triplet button": ({ partId, rows: r, ctx }) => groupRunEndingAt(partId, r[4].id, 3, ctx),
  tripletFromTail: ({ partId, ctx }) => tripletFromTail(partId, 3, ctx),
  "ungroup toolbar": ({ rows: r, ctx }) => ungroupTuplet(r.slice(1, 3), ctx),
  "ungroup sheet": ({ rows: r, ctx }) => ungroupTuplet([r[1]], ctx),
};

export async function fiveWithOldGroup(w: World, kind: "tuplet" | "plain" = "tuplet") {
  const before = await build(w, "nnnnn");
  await groupSelection(w.part.id, before[0].id, before[2].id, kind, w.ctx);
  return rows(w);
}
