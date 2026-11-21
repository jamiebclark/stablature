import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";
import { HlcClock } from "../../hlc";
import { newId } from "../../ids";
import { StablatureDb } from "../../local/db";
import { renameMemo, saveMemo } from "../../local/memos";
import { memoRowSchema } from "../../sync/protocol";
import { LABEL_MAX, MAX_BYTES } from "../limits";
import { createRecorder } from "../recorder";
import { resetSound } from "../sound";
import { fakePorts } from "./recorder-fakes";

/**
 * INV-019: a row that `saveMemo` writes always passes the wire schema, for every keep ending and every format the
 * recorder can name, because a row that fails it would make every push of its batch a 400.
 * E13 (recovered) joins when recovery lands with US3.
 */
let db: StablatureDb;
let clock: HlcClock;
const part = { id: newId(), bandId: newId(), songId: newId(), label: "A" };

beforeEach(async () => {
  resetSound();
  db = new StablatureDb(`test-${newId()}`);
  await db.open();
  clock = new HlcClock("testnode", () => 1_000_000);
});

const FORMATS = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/ogg",
  "audio/ogg;codecs=opus",
];

const MiB = 1024 * 1024;

type Trigger = (f: ReturnType<typeof fakePorts>, r: ReturnType<typeof createRecorder>) => Promise<void>;
const KEEP_ENDINGS: Record<string, Trigger> = {
  E1: async (f, r) => {
    await f.advance(4000);
    r.stop();
  },
  E2: async (f) => {
    await f.advance(180_000);
  },
  E3: async (f) => {
    for (let i = 0; i < 7; i++) {
      await f.advance(1000);
      await f.chunk(MiB);
    }
  },
  E7: async (f) => {
    await f.advance(3000);
    f.track.onended?.();
  },
  E8: async (f) => {
    await f.advance(3000);
    f.fireHidden();
  },
  E9: async (f, r) => {
    await f.advance(3000);
    r.leave();
  },
  E10: async (f) => {
    await f.advance(3000);
    f.recorder.onerror?.();
  },
};

describe("every kept row passes memoRowSchema", () => {
  for (const format of FORMATS) {
    for (const [ending, trigger] of Object.entries(KEEP_ENDINGS)) {
      it(`${ending} as ${format}`, async () => {
        const f = fakePorts({ mime: format, finalChunk: 2000 });
        f.ports.save = (draft, bytes, ms) => saveMemo(draft, bytes, ms, { db, clock }).then(() => undefined);
        const r = createRecorder(f.ports);
        r.start(part);
        await f.settle();
        await f.chunk(2000);
        await trigger(f, r);
        await f.settle();
        const rows = await db.memos.toArray();
        expect(rows).toHaveLength(1);
        expect(() => memoRowSchema.parse(rows[0])).not.toThrow();
        expect(rows[0].size).toBeLessThanOrEqual(MAX_BYTES);
        expect(await db.memoAudio.get(rows[0].id)).toBeDefined();
        expect(await db.memoUploads.get(rows[0].id)).toBeDefined();
        expect(await db.outbox.count()).toBe(1);
      });
    }
  }
});

describe("renameMemo", () => {
  it.each([
    ["", null],
    ["   ", null],
    ["a", "a"],
    ["x".repeat(LABEL_MAX), "x".repeat(LABEL_MAX)],
    ["x".repeat(LABEL_MAX + 1), "x".repeat(LABEL_MAX)],
    ["x".repeat(500), "x".repeat(LABEL_MAX)],
    ["  spaced  ", "spaced"],
  ])("label %j keeps the row valid", async (label, stored) => {
    const draft = {
      id: newId(), memoId: newId(), partId: part.id, bandId: part.bandId, songId: part.songId,
      format: "audio/webm;codecs=opus", startedAt: 1,
    };
    await saveMemo(draft, new ArrayBuffer(10), 2000, { db, clock });
    await renameMemo(draft.memoId, label, { db, clock });
    const row = (await db.memos.get(draft.memoId))!;
    expect(row.label).toBe(stored);
    expect(() => memoRowSchema.parse(row)).not.toThrow();
  });
});
