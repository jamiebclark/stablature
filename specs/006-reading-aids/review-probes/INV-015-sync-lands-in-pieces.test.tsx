// @vitest-environment jsdom
/**
 * INV-015, member "a sync batch", through the real `applyRemoteRows`.
 *
 * `snapshot.test.ts` writes its "sync batch" with `mutateBatch`, one transaction, and that is not how a pull
 * lands: `applyRemoteRows` commits one transaction per table, parts then events then annotations. One read
 * transaction makes each read consistent with the database. It cannot help when the database itself holds a
 * variant with no columns yet. This reads after every commit, and records what the live hook renders.
 *
 * The judgement goes through `syncNow` with `fetch` stubbed, not `applyRemoteRows` alone, so it passes under
 * either repair: one transaction for a pull, or a read that holds while the status says `syncing`.
 * `INV-003-015-031-two-devices.spec.ts` is the same judgement with nothing stubbed. If a fix renders through a
 * new hook, this must read that hook: what it reads is what the pages read.
 */
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HlcClock } from "@/lib/hlc";
import { newId } from "@/lib/ids";
import { db, StablatureDb } from "@/lib/local/db";
import {
  appendNote, createBand, createPart, createSong, createTuningFromPreset, createVariant, setChord,
} from "@/lib/local/editing";
import { useSongContent } from "@/lib/local/hooks";
import { listEvents, listSongContent, type SongContent } from "@/lib/local/queries";
import type { PartRow, TuningRow } from "@/lib/model";
import { compareVariants } from "@/lib/reading/compare";
import { layoutReading } from "@/lib/reading/labels";
import { staffMarks } from "@/lib/reading/marks";
import { applyRemoteRows, syncNow } from "@/lib/sync/client";
import { presetById } from "@/lib/tunings";

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
  /** Not a judgement: what each commit of the pull leaves for a read, for the review's evidence. */
  it("records what a read sees after each commit", async () => {
    const { tuning, song, rows } = await twoDevices();
    const seen: string[] = [];
    const real = db.transaction.bind(db) as (...args: unknown[]) => Promise<unknown>;
    vi.spyOn(db, "transaction").mockImplementation(((...args: unknown[]) => {
      const done = real(...args);
      if (args[0] !== "rw") return done;
      return done.then(async (value) => {
        const names = (args[1] as { name: string }[]).map((t) => t.name).join();
        seen.push(`${names}: ${lines(await listSongContent(song.id, db), tuning).join(" / ") || "(no variant yet)"}`);
        return value;
      });
    }) as never);
    await applyRemoteRows(rows as never, db);
    vi.restoreAllMocks();
    writeFileSync(path.join(tmpdir(), "spec006-inv015.json"), JSON.stringify(seen, null, 1));
    expect(seen.length).toBeGreaterThan(0);
  });

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
