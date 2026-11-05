// @vitest-environment jsdom
/**
 * INV-015: a consumer of `useSongContent` never renders a part without its columns, or columns without their
 * chords, however the writes arrive (parts first, events first, annotations first, a batch, a paste, a sync batch).
 */
import "fake-indexeddb/auto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HlcClock } from "@/lib/hlc";
import { newId } from "@/lib/ids";
import { db, StablatureDb } from "@/lib/local/db";
import { appendNote, createBand, createPart, createSong, createTuningFromPreset, createVariant, setChord } from "@/lib/local/editing";
import { useSongContent } from "@/lib/local/hooks";
import { insertRow, mutateBatch } from "@/lib/local/mutate";
import { listEvents, type SongContent } from "@/lib/local/queries";
import type { PartRow, TuningRow } from "@/lib/model";
import { compareVariants } from "@/lib/reading/compare";
import { layoutReading } from "@/lib/reading/labels";
import { staffMarks } from "@/lib/reading/marks";
import { syncNow } from "@/lib/sync/client";
import { presetById } from "@/lib/tunings";

const bandId = "band";
const songId = "song";

const part = (id: string) =>
  insertRow("parts", { id, bandId, songId, label: id, name: null, rank: id, variantOfPartId: null, notes: null });
const column = (partId: string, id: string, rank: string) =>
  insertRow("events", {
    id, bandId, partId, rank, kind: "notes" as const, frets: { "3": 5 }, techniques: {}, repeat: 1,
    durationHint: null, tupletId: null, tupletCount: null,
  });
const chord = (partId: string, anchorEventId: string) =>
  insertRow("annotations", { id: newId(), bandId, partId, anchorEventId, kind: "chord", value: "Am" });

/** Every part has columns and chords entries; every chord's anchor is among its columns. */
function whole(c: SongContent): string | null {
  for (const p of c.parts) {
    const events = c.eventsByPart[p.id];
    const annotations = c.annotationsByPart[p.id];
    if (!events) return `part ${p.id} without columns`;
    if (!annotations) return `part ${p.id} without annotations`;
    const ids = new Set(events.map((e) => e.id));
    for (const a of annotations) if (a.anchorEventId && !ids.has(a.anchorEventId)) return `chord ${a.id} without its column`;
  }
  return null;
}

beforeEach(async () => {
  await db.open();
  for (const t of [db.parts, db.events, db.annotations, db.outbox]) await t.clear();
});

async function observe(writes: () => Promise<void>) {
  const seen: (SongContent | undefined)[] = [];
  const { result } = renderHook(() => {
    const value = useSongContent(songId);
    seen.push(value);
    return value;
  });
  await waitFor(() => expect(result.current).toBeDefined());
  await act(async () => {
    await writes();
  });
  await waitFor(() => expect(result.current?.parts.length ?? 0).toBeGreaterThan(0));
  for (const value of seen) if (value) expect(whole(value)).toBeNull();
  return result.current!;
}

describe("useSongContent never renders a torn song (INV-015)", () => {
  it("parts first, then columns, then chords", async () => {
    await observe(async () => {
      await part("a");
      await column("a", "e1", "a");
      await chord("a", "e1");
    });
    await waitFor(async () => expect((await db.annotations.count())).toBe(1));
  });

  it("columns and chords before the part", async () => {
    await observe(async () => {
      await column("a", "e1", "a");
      await chord("a", "e1");
      await part("a");
    });
  });

  it("annotations first", async () => {
    await observe(async () => {
      await chord("a", "e1");
      await column("a", "e1", "a");
      await part("a");
    });
  });

  it("one batch (a variant, a paste, a sync batch)", async () => {
    await observe(async () => {
      await mutateBatch(async (inner) => {
        await insertRow("parts", { id: "a", bandId, songId, label: "a", name: null, rank: "a", variantOfPartId: null, notes: null }, inner);
        for (const [i, id] of ["e1", "e2", "e3"].entries()) {
          await insertRow("events", { id, bandId, partId: "a", rank: String.fromCharCode(97 + i), kind: "notes" as const, frets: { "3": i }, techniques: {}, repeat: 1, durationHint: null, tupletId: null, tupletCount: null }, inner);
        }
        await insertRow("annotations", { id: newId(), bandId, partId: "a", anchorEventId: "e2", kind: "chord", value: "Am" }, inner);
      });
    });
  });

  it("returns undefined before it has loaded, and nothing for no song", async () => {
    const { result } = renderHook(() => useSongContent(undefined));
    expect(result.current).toBeUndefined();
  });
});

/** A pull lands as one transaction per table; the pages must not draw the pieces (review F1). */
const clockFrom = (id: string) => {
  let now = 1_000_000;
  return new HlcClock(id, () => (now += 1));
};

/** What the page would write under the variant for this read. */
function lines(content: SongContent | undefined, tuning: TuningRow) {
  if (!content) return [];
  return [...compareVariants(content, tuning).entries()].map(([id, comparison]) =>
    staffMarks(comparison, { events: content.eventsByPart[id], fromBar: null, toBar: null, density: "expanded" }).line,
  );
}

/** A song on `db`, and the same song plus a new variant on a second device. */
async function twoDevices() {
  const here = { db, clock: clockFrom("here") };
  const band = await createBand("Hollow Crown", here);
  const tuning = await createTuningFromPreset(band.id, presetById("bass5-b")!, true, here);
  const song = await createSong(band.id, "Dirge", tuning.id, here);
  const part = await createPart(song, here);
  await appendNote(part, 3, 5, here);
  await appendNote(part, 3, 7, here);
  await appendNote(part, 3, 8, here);
  const events = await listEvents(part.id, db);
  await setChord(part, events[0].id, "Am", here);

  const there = new StablatureDb(`there-${newId()}`);
  await there.open();
  for (const name of ["bands", "tunings", "songs", "parts", "events", "annotations"] as const) {
    const table = db[name] as unknown as { toArray(): Promise<unknown[]> };
    await (there[name] as unknown as { bulkPut(rows: unknown[]): Promise<unknown> }).bulkPut(await table.toArray());
  }
  const variant = await createVariant(part as PartRow, { db: there, clock: clockFrom("there") });
  const rows = {
    parts: [await there.parts.get(variant.id)],
    events: await there.events.where("partId").equals(variant.id).toArray(),
    annotations: await there.annotations.where("partId").equals(variant.id).toArray(),
  };
  return { tuning, song, part, rows };
}

describe("INV-015 a variant arriving by sync", () => {
  it("never renders anything but the same as its parent, in the line or the cells", async () => {
    const { tuning, song, part, rows } = await twoDevices();
    const rendered: string[] = [];
    const { result } = renderHook(() => {
      const content = useSongContent(song.id);
      for (const line of lines(content, tuning)) rendered.push(line);
      if (content) {
        for (const candidate of content.parts) {
          if (candidate.id === part.id) continue;
          const events = content.eventsByPart[candidate.id];
          const layout = layoutReading({ view: "intervals", events, partEvents: events, tuning, annotations: content.annotationsByPart[candidate.id] });
          // The parent reads against Am from its first column, so a copy of it must too.
          if (events.length > 0 && layout.chordCover !== "all") rendered.push(`cells without their chord: ${layout.chordCover}`);
        }
      }
      return content;
    });
    await waitFor(() => expect(result.current).toBeDefined());
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ rows, cursor: 1, hasMore: false, bandIds: [] }), { status: 200 }),
    );
    // A pull's commits are separated by real work and, across pages, by a network round trip. Unslowed, jsdom
    // happens to finish all three inside one render, and this passes with the invariant broken: it did, once.
    const real = db.transaction.bind(db) as (...args: unknown[]) => Promise<unknown>;
    vi.spyOn(db, "transaction").mockImplementation(((...args: unknown[]) => {
      const done = real(...args);
      if (args[0] !== "rw") return done;
      return done.then(async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return value;
      });
    }) as never);
    // Not inside `act`: it holds every update to the end and renders only the last, which is the one thing a
    // screen does not do, and it hides the flash completely.
    const scope = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean };
    scope.IS_REACT_ACT_ENVIRONMENT = false;
    await syncNow(db);
    await new Promise((resolve) => setTimeout(resolve, 40));
    scope.IS_REACT_ACT_ENVIRONMENT = true;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await waitFor(() => expect(result.current?.parts.length).toBeGreaterThan(1));
    await waitFor(() => expect(result.current?.annotationsByPart[rows.parts[0]!.id]?.length).toBeGreaterThan(0));
    expect(rendered.filter((line) => line !== "Same as A")).toEqual([]);
  });
});
