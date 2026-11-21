import { describe, expect, it, vi } from "vitest";
import { TIMESLICE_MS } from "../limits";
import type { MemoDraft } from "../../local/db";
import { recoverDrafts, type RecoverDeps } from "../recover";

/** INV-008, unit half: recoverDrafts over the five draft cases. */
const draft = (id: string, partId = "p1"): MemoDraft => ({
  id,
  memoId: `m-${id}`,
  partId,
  bandId: "b",
  songId: "s",
  format: "audio/webm;codecs=opus",
  startedAt: 0,
});
const chunks = (n: number) => Array.from({ length: n }, () => new ArrayBuffer(100));

function run(
  items: { draft: MemoDraft; chunks: ArrayBuffer[] }[],
  opts: { playable?: boolean; live?: boolean; durationMs?: number | null } = {},
) {
  const saves: { id: string; ms: number }[] = [];
  const dropped: string[] = [];
  const notices: { partId: string; kind: string; words: string }[] = [];
  const deps: RecoverDeps = {
    drafts: async () => items,
    partLive: async () => opts.live ?? true,
    probe: vi.fn(async () => ({ playable: opts.playable ?? true, durationMs: opts.durationMs ?? null })),
    save: async (d, _b, ms) => void saves.push({ id: d.id, ms }),
    drop: async (id) => void dropped.push(id),
    notice: async (n) => void notices.push(n),
  };
  return { deps, saves, dropped, notices };
}

describe("recoverDrafts", () => {
  it("a playable prefix is saved with the recovered words", async () => {
    const r = run([{ draft: draft("a"), chunks: chunks(4_000 / TIMESLICE_MS) }]);
    expect(await recoverDrafts(r.deps)).toBe(1);
    expect(r.saves).toEqual([{ id: "a", ms: 4_000 }]);
    expect(r.notices[0].words).toBe("A recording was cut off when the app closed. The first 0:04 was recovered.");
  });

  it("the metadata duration caps the length", async () => {
    const r = run([{ draft: draft("a"), chunks: chunks(4_000 / TIMESLICE_MS) }], { durationMs: 3_200 });
    await recoverDrafts(r.deps);
    expect(r.saves[0].ms).toBe(3_200);
  });

  it("an unplayable prefix is dropped with the unrecoverable words", async () => {
    const r = run([{ draft: draft("a"), chunks: chunks(4_000 / TIMESLICE_MS) }], { playable: false });
    expect(await recoverDrafts(r.deps)).toBe(0);
    expect(r.saves).toEqual([]);
    expect(r.dropped).toEqual(["a"]);
    expect(r.notices[0].words).toBe("A recording was cut off when the app closed and couldn't be recovered.");
  });

  it("under one second is dropped, not kept", async () => {
    const r = run([{ draft: draft("a"), chunks: [] }]);
    await recoverDrafts(r.deps);
    expect(r.saves).toEqual([]);
    expect(r.dropped).toEqual(["a"]);
    expect(r.notices[0].kind).toBe("unrecoverable");
  });

  it("a tombstoned or absent part: dropped, no memo, no notice", async () => {
    const r = run([{ draft: draft("a"), chunks: chunks(4_000 / TIMESLICE_MS) }], { live: false });
    await recoverDrafts(r.deps);
    expect(r.saves).toEqual([]);
    expect(r.dropped).toEqual(["a"]);
    expect(r.notices).toEqual([]);
  });
});
