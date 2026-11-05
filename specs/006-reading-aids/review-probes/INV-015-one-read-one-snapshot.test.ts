/**
 * INV-015's read half: `listSongContent` is one `r` transaction, so a write landing during a read is all in or all out.
 *
 * `run-mutants.mjs` showed that taking the transaction out passes all of `snapshot.test.ts`: every test there
 * awaits each write, so no write ever lands in the middle of a read. Here the write is queued in the same tick as
 * the read, and it changes all three tables at once. A torn read mixes the old with the new.
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/local/db";
import { listSongContent } from "@/lib/local/queries";
import type { AnnotationRow, EventRow, PartRow } from "@/lib/model";

const songId = "song";
const stamp = { updatedAt: "", deletedAt: null, fieldClocks: {}, serverSeq: 0 };
const part = (label: string) =>
  ({ ...stamp, id: "p", bandId: "b", songId, label, name: null, rank: "a", variantOfPartId: null, notes: null }) as unknown as PartRow;
const event = (fret: number) =>
  ({
    ...stamp, id: "e", bandId: "b", partId: "p", rank: "a", kind: "notes", frets: { 0: fret }, techniques: {}, repeat: 1,
    durationHint: null, tupletId: null, tupletCount: null, groupKind: null,
  }) as unknown as EventRow;
const chord = (value: string) =>
  ({ ...stamp, id: "c", bandId: "b", partId: "p", anchorEventId: "e", kind: "chord", value }) as unknown as AnnotationRow;

beforeEach(async () => {
  await db.open();
  for (const table of [db.parts, db.events, db.annotations]) await table.clear();
  await db.parts.put(part("old"));
  await db.events.put(event(1));
  await db.annotations.put(chord("Am"));
});

describe("a write landing during the read", () => {
  it("is all in or all out, at every point a read can be overtaken", async () => {
    for (let round = 0; round < 40; round += 1) {
      await db.parts.put(part("old"));
      await db.events.put(event(1));
      await db.annotations.put(chord("Am"));
      const read = listSongContent(songId);
      // Each rung lets the read get a little further before the write is queued.
      for (let step = 0; step < round % 8; step += 1) await Promise.resolve();
      const write = db.transaction("rw", [db.parts, db.events, db.annotations], async () => {
        await db.parts.put(part("new"));
        await db.events.put(event(2));
        await db.annotations.put(chord("Em"));
      });
      const [content] = await Promise.all([read, write]);
      const seen = [
        content.parts[0].label,
        content.eventsByPart.p?.[0]?.frets[0],
        content.annotationsByPart.p?.[0]?.value,
      ];
      expect([JSON.stringify(["old", 1, "Am"]), JSON.stringify(["new", 2, "Em"])], `round ${round}`).toContain(JSON.stringify(seen));
    }
  });
});
