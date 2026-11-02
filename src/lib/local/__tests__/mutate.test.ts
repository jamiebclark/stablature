import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";
import { HlcClock } from "../../hlc";
import { newId } from "../../ids";
import { StablatureDb } from "../db";
import { deleteRow, insertRow, mutateBatch, patchRow, restoreRow } from "../mutate";

let db: StablatureDb;
let clock: HlcClock;
let now: number;

beforeEach(async () => {
  // A fresh database per test, named uniquely so fake-indexeddb does not
  // carry state between them.
  db = new StablatureDb(`test-${newId()}`);
  await db.open();
  now = 1_000_000;
  clock = new HlcClock("testnode", () => now);
});

const ctx = () => ({ db, clock });

async function makeBand(name = "Hollow Crown") {
  return insertRow("bands", { id: newId(), name, slug: name.toLowerCase() }, ctx());
}

async function makeSong(bandId: string, title = "Untitled") {
  return insertRow(
    "songs",
    { id: newId(), bandId, title, tuningId: null, bpm: null, notes: null },
    ctx(),
  );
}

describe("insertRow", () => {
  it("stores the row and queues exactly one outbox entry", async () => {
    const band = await makeBand();

    expect(await db.bands.get(band.id)).toMatchObject({ name: "Hollow Crown" });
    const queued = await db.outbox.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ table: "bands", rowId: band.id, attempts: 0 });
  });

  it("queues the whole row, so a retry cannot apply against the wrong base", async () => {
    const band = await makeBand();
    const [entry] = await db.outbox.toArray();
    expect(entry.row).toEqual(band);
  });

  it("marks the row as never pushed", async () => {
    expect((await makeBand()).serverSeq).toBe(0);
  });

  it("stamps a strictly later clock on each successive write", async () => {
    const first = await makeBand("One");
    const second = await makeBand("Two");
    expect(second.updatedAt > first.updatedAt).toBe(true);
  });
});

describe("patchRow", () => {
  it("updates only the named fields and clocks only those", async () => {
    const band = await makeBand();
    const song = await makeSong(band.id, "Hollow");

    now += 1000;
    const patched = await patchRow("songs", song.id, { bpm: 122 }, ctx());

    expect(patched.bpm).toBe(122);
    expect(patched.title).toBe("Hollow");
    expect(patched.fieldClocks.bpm).toBe(patched.updatedAt);
    // The untouched field keeps its creation clock -- this is what lets a
    // concurrent title edit from another device survive.
    expect(patched.fieldClocks.title).toBe(song.updatedAt);
  });

  it("queues a second outbox entry rather than replacing the first", async () => {
    const band = await makeBand();
    const song = await makeSong(band.id);
    await patchRow("songs", song.id, { title: "Renamed" }, ctx());

    // bands insert + songs insert + songs patch
    expect(await db.outbox.count()).toBe(3);
  });

  it("rejects a patch to a row that is not here", async () => {
    await expect(patchRow("songs", newId(), { title: "Nope" }, ctx())).rejects.toThrow(
      /no such row/,
    );
  });

  it("leaves nothing behind when it fails", async () => {
    await expect(patchRow("songs", newId(), { title: "Nope" }, ctx())).rejects.toThrow();
    expect(await db.outbox.count()).toBe(0);
  });

  it("refuses to patch a structural field", async () => {
    const band = await makeBand();
    const song = await makeSong(band.id);
    await expect(
      patchRow("songs", song.id, { bandId: newId() } as never, ctx()),
    ).rejects.toThrow(/not mergeable/);
  });
});

describe("deleteRow", () => {
  it("tombstones rather than removing", async () => {
    const band = await makeBand();
    const song = await makeSong(band.id);

    now += 1000;
    await deleteRow("songs", song.id, ctx());

    const stored = await db.songs.get(song.id);
    expect(stored).toBeDefined();
    expect(stored!.deletedAt).not.toBeNull();
    // Title survives, because a tombstone is a field write, not a removal.
    expect(stored!.title).toBe("Untitled");
  });

  it("round-trips through restore", async () => {
    const band = await makeBand();
    const song = await makeSong(band.id);

    now += 1000;
    await deleteRow("songs", song.id, ctx());
    now += 1000;
    await restoreRow("songs", song.id, ctx());

    expect((await db.songs.get(song.id))!.deletedAt).toBeNull();
  });
});

describe("mutateBatch", () => {
  it("commits several rows from one gesture together", async () => {
    const band = await makeBand();

    await mutateBatch(async (inner) => {
      const song = await insertRow(
        "songs",
        { id: newId(), bandId: band.id, title: "New", tuningId: null, bpm: null, notes: null },
        inner,
      );
      await insertRow(
        "parts",
        {
          id: newId(),
          bandId: band.id,
          songId: song.id,
          label: "A",
          name: null,
          rank: "a0",
          variantOfPartId: null,
          notes: null,
        },
        inner,
      );
    }, ctx());

    expect(await db.songs.count()).toBe(1);
    expect(await db.parts.count()).toBe(1);
  });

  it("rolls back the whole gesture if any part of it fails", async () => {
    const band = await makeBand();
    const before = await db.outbox.count();

    await expect(
      mutateBatch(async (inner) => {
        await insertRow(
          "songs",
          { id: newId(), bandId: band.id, title: "Doomed", tuningId: null, bpm: null, notes: null },
          inner,
        );
        // A part referencing a song that does not exist locally: the kind of
        // bug that must not leave a half-created song behind.
        await patchRow("parts", newId(), { label: "B" }, inner);
      }, ctx()),
    ).rejects.toThrow();

    expect(await db.songs.count()).toBe(0);
    expect(await db.outbox.count()).toBe(before);
  });
});
