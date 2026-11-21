import { describe, expect, it, vi } from "vitest";
import { ensurePersisted, type PersistDeps, type StorageManagerLike } from "../storage";
import { EXTRA_NOTICE_WORDS } from "../words";

/** INV-029, unit half. */
function make(storage: StorageManagerLike | null, flags: { asked?: boolean; shown?: boolean } = {}) {
  const state = { asked: flags.asked ?? false, shown: flags.shown ?? false };
  const deps: PersistDeps = {
    storage,
    asked: () => state.asked,
    markAsked: () => (state.asked = true),
    noticeShown: () => state.shown,
    markNoticeShown: () => (state.shown = true),
  };
  return { deps, state, notice: vi.fn(async () => {}) };
}

const storageOf = (persisted: boolean, persist: () => Promise<boolean>) => {
  const persistSpy = vi.fn(persist);
  return { persisted: async () => persisted, persist: persistSpy } satisfies StorageManagerLike;
};

describe("ensurePersisted", () => {
  it("already persisted: no persist(), no notice", async () => {
    const s = storageOf(true, async () => true);
    const m = make(s);
    await ensurePersisted(m.notice, m.deps);
    expect(s.persist).not.toHaveBeenCalled();
    expect(m.notice).not.toHaveBeenCalled();
  });

  it("persist() granted: one call, no notice", async () => {
    const s = storageOf(false, async () => true);
    const m = make(s);
    await ensurePersisted(m.notice, m.deps);
    expect(s.persist).toHaveBeenCalledTimes(1);
    expect(m.notice).not.toHaveBeenCalled();
  });

  it("persist() refused: a notice, once, and never a second persist()", async () => {
    const s = storageOf(false, async () => false);
    const m = make(s);
    await ensurePersisted(m.notice, m.deps);
    await ensurePersisted(m.notice, m.deps);
    expect(s.persist).toHaveBeenCalledTimes(1);
    expect(m.notice).toHaveBeenCalledTimes(1);
    expect(m.notice).toHaveBeenCalledWith(EXTRA_NOTICE_WORDS.persist);
  });

  it("persist() rejects: treated as refused", async () => {
    const s = storageOf(false, async () => {
      throw new Error("no");
    });
    const m = make(s);
    await ensurePersisted(m.notice, m.deps);
    expect(s.persist).toHaveBeenCalledTimes(1);
    expect(m.notice).toHaveBeenCalledTimes(1);
  });

  it("no navigator.storage: a notice, nothing to call", async () => {
    const m = make(null);
    await ensurePersisted(m.notice, m.deps);
    expect(m.notice).toHaveBeenCalledTimes(1);
  });

  it("already asked on an earlier visit: does not ask again", async () => {
    const s = storageOf(false, async () => true);
    const m = make(s, { asked: true, shown: true });
    await ensurePersisted(m.notice, m.deps);
    expect(s.persist).not.toHaveBeenCalled();
    expect(m.notice).not.toHaveBeenCalled();
  });
});
