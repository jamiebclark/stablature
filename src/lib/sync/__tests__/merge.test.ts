import { describe, expect, it } from "vitest";
import { encodeHlc, type Hlc } from "../../hlc";
import type { SongRow } from "../../model";
import { applyPatch, deriveUpdatedAt, mergeRow, stampNewRow } from "../merge";

/** Readable HLCs: `at(5, "phone")` sorts before `at(6, "phone")`. */
const at = (ms: number, node = "a"): Hlc => encodeHlc({ wallMs: ms, counter: 0, nodeId: node });

function song(overrides: Partial<SongRow> = {}): SongRow {
  return stampNewRow(
    "songs",
    {
      id: "00000000-0000-7000-8000-000000000001",
      bandId: "00000000-0000-7000-8000-0000000000bb",
      title: "Untitled",
      tuningId: null,
      bpm: null,
      notes: null,
      deletedAt: null,
      ...overrides,
    },
    at(1),
  );
}

/** Every ordering of `items`, for asserting order-independence. */
function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

describe("stampNewRow", () => {
  it("clocks every mergeable field so later edits compare cleanly", () => {
    const row = song();
    expect(row.fieldClocks).toEqual({
      title: at(1),
      tuningId: at(1),
      bpm: at(1),
      notes: at(1),
      deletedAt: at(1),
    });
    expect(row.updatedAt).toBe(at(1));
  });

  it("starts at serverSeq 0, which is how the outbox spots an unpushed row", () => {
    expect(song().serverSeq).toBe(0);
  });
});

describe("applyPatch", () => {
  it("clocks only the fields actually touched", () => {
    const patched = applyPatch("songs", song(), { title: "Hollow" }, at(5));
    expect(patched.title).toBe("Hollow");
    expect(patched.fieldClocks.title).toBe(at(5));
    // Untouched fields keep their original clock, which is the entire point.
    expect(patched.fieldClocks.bpm).toBe(at(1));
    expect(patched.updatedAt).toBe(at(5));
  });

  it("refuses to patch a structural field", () => {
    // bandId is set once at creation. Letting it be patched would mean a row
    // could change which band it belongs to mid-merge.
    expect(() =>
      applyPatch("songs", song(), { bandId: "other" } as never, at(5)),
    ).toThrow(/not mergeable/);
  });
});

describe("mergeRow", () => {
  it("takes a row it has never seen wholesale", () => {
    const remote = { ...song({ title: "Remote" }), serverSeq: 7 };
    expect(mergeRow("songs", undefined, remote)).toMatchObject({ title: "Remote", serverSeq: 7 });
  });

  it("keeps the newer side of a genuine same-field conflict", () => {
    const base = song();
    const mine = applyPatch("songs", base, { title: "Mine" }, at(10));
    const theirs = applyPatch("songs", base, { title: "Theirs" }, at(20));
    expect(mergeRow("songs", mine, theirs).title).toBe("Theirs");
  });

  it("rejects a stale write without discarding the rest of the row", () => {
    const base = song();
    const newer = applyPatch("songs", base, { title: "Newer" }, at(20));
    const stale = applyPatch("songs", base, { title: "Stale" }, at(10));
    const merged = mergeRow("songs", newer, stale);
    expect(merged.title).toBe("Newer");
    expect(merged.fieldClocks.title).toBe(at(20));
  });

  it("keeps BOTH of two concurrent edits to different fields", () => {
    // The case a single row-level clock gets wrong: one person renames a song
    // offline while another sets its BPM. Neither edit conflicts, so losing
    // either one would be a bug the user would never forgive.
    const base = song();
    const renamed = applyPatch("songs", base, { title: "Hollow Crown" }, at(10));
    const tempoed = applyPatch("songs", base, { bpm: 122 }, at(20));

    const merged = mergeRow("songs", renamed, tempoed);
    expect(merged.title).toBe("Hollow Crown");
    expect(merged.bpm).toBe(122);
  });

  it("reaches the same row no matter what order edits arrive in", () => {
    const base = song();
    const edits = [
      applyPatch("songs", base, { title: "Hollow Crown" }, at(10)),
      applyPatch("songs", base, { bpm: 122 }, at(20)),
      applyPatch("songs", base, { notes: "half-step down" }, at(15)),
      applyPatch("songs", base, { title: "Hollow Crown II" }, at(30)),
    ];

    const results = permutations(edits).map((order) =>
      order.reduce<SongRow>((acc, remote) => mergeRow("songs", acc, remote), base),
    );

    // 24 orderings, one outcome: this is the convergence property the whole
    // sync design leans on.
    expect(results).toHaveLength(24);
    for (const result of results) {
      expect(result).toEqual(results[0]);
    }
    expect(results[0]).toMatchObject({
      title: "Hollow Crown II",
      bpm: 122,
      notes: "half-step down",
    });
  });

  it("is idempotent", () => {
    const base = song();
    const remote = applyPatch("songs", base, { title: "Once" }, at(10));
    const once = mergeRow("songs", base, remote);
    expect(mergeRow("songs", once, remote)).toEqual(once);
  });

  it("breaks exact-tie conflicts deterministically by node id", () => {
    // Two devices, same millisecond, same counter. Whichever node id sorts
    // higher wins -- arbitrary, but identical on every replica.
    const base = song();
    const fromPhone = applyPatch("songs", base, { title: "Phone" }, at(10, "phone"));
    const fromLaptop = applyPatch("songs", base, { title: "Laptop" }, at(10, "laptop"));
    expect(mergeRow("songs", fromLaptop, fromPhone).title).toBe("Phone");
    expect(mergeRow("songs", fromPhone, fromLaptop).title).toBe("Phone");
  });

  it("treats a delete as an ordinary clocked field, so an undelete works", () => {
    const base = song();
    const deleted = applyPatch("songs", base, { deletedAt: at(10) }, at(10));
    expect(mergeRow("songs", base, deleted).deletedAt).toBe(at(10));

    const restored = applyPatch("songs", deleted, { deletedAt: null }, at(20));
    expect(mergeRow("songs", deleted, restored).deletedAt).toBeNull();
  });

  it("lets a later edit survive an earlier delete without resurrecting the row", () => {
    const base = song();
    const deleted = applyPatch("songs", base, { deletedAt: at(20) }, at(20));
    const renamed = applyPatch("songs", base, { title: "Renamed" }, at(10));
    const merged = mergeRow("songs", deleted, renamed);
    // The rename lands on the field, but the tombstone is newer and stands.
    expect(merged.title).toBe("Renamed");
    expect(merged.deletedAt).toBe(at(20));
  });

  it("ignores fields a newer client version might send", () => {
    const base = song();
    const remote = {
      ...base,
      fieldClocks: { ...base.fieldClocks, somethingNew: at(99) },
      somethingNew: "from the future",
    } as SongRow;
    const merged = mergeRow("songs", base, remote) as unknown as Record<string, unknown>;
    expect(merged.somethingNew).toBeUndefined();
  });

  it("moves serverSeq forward only", () => {
    const local = { ...song(), serverSeq: 12 };
    const remote = { ...song(), serverSeq: 5 };
    expect(mergeRow("songs", local, remote).serverSeq).toBe(12);
  });
});

describe("deriveUpdatedAt", () => {
  it("is the max of the field clocks", () => {
    expect(deriveUpdatedAt({ a: at(5), b: at(50), c: at(10) })).toBe(at(50));
  });

  it("falls back when there are no clocks at all", () => {
    expect(deriveUpdatedAt({}, at(3))).toBe(at(3));
  });
});
