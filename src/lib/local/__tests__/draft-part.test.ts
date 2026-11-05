import "fake-indexeddb/auto";

import { describe, expect, it, vi } from "vitest";
import { ranksBetween } from "../../rank";
import { draftPart, rowsFromClipboard, type Clipboard } from "../clipboard";
import { db } from "../db";

const clipboard: Clipboard = {
  columns: [
    { kind: "notes", frets: { "0": 3 }, techniques: {}, repeat: 1, durationHint: null, tupletGroup: 0, tupletCount: 3 },
    { kind: "notes", frets: { "1": 5 }, techniques: {}, repeat: 2, durationHint: null, tupletGroup: 0, tupletCount: 3 },
    { kind: "barline", frets: {}, techniques: {}, repeat: 1, durationHint: null, tupletGroup: null, tupletCount: null },
  ],
  annotations: [
    { columnIndex: 0, kind: "chord", value: "Em" },
    { columnIndex: 9, kind: "text", value: "lost" },
  ],
};

describe("draftPart (INV-022)", () => {
  it("writes nothing even when every write would throw", () => {
    const boom = vi.fn(() => {
      throw new Error("write");
    });
    const spies = [
      vi.spyOn(db.events, "put").mockImplementation(boom),
      vi.spyOn(db.events, "add").mockImplementation(boom),
      vi.spyOn(db.annotations, "put").mockImplementation(boom),
      vi.spyOn(db, "transaction").mockImplementation(boom),
    ];
    expect(() => draftPart(clipboard)).not.toThrow();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    spies.forEach((spy) => spy.mockRestore());
  });

  it("returns the rows a paste would insert", () => {
    const draft = draftPart(clipboard);
    let n = 0;
    const rows = rowsFromClipboard(
      { id: "draft-part", bandId: "draft-band" },
      clipboard,
      ranksBetween(null, null, 3),
      () => `draft-${n++}`,
    );
    expect(draft.events.map(({ id, rank, frets, repeat, tupletId }) => ({ id, rank, frets, repeat, tupletId }))).toEqual(
      rows.events.map(({ id, rank, frets, repeat, tupletId }) => ({ id, rank, frets, repeat, tupletId })),
    );
    expect(draft.events.every((e) => e.id.startsWith("draft-"))).toBe(true);
    expect(draft.events.map((e) => e.rank)).toEqual(ranksBetween(null, null, 3));
    expect(draft.events[0].tupletId).not.toBeNull();
    expect(draft.events[0].tupletId).toBe(draft.events[1].tupletId);
    expect(draft.events[2].tupletId).toBeNull();
    expect(draft.annotations).toHaveLength(1);
    expect(draft.annotations[0].anchorEventId).toBe(draft.events[0].id);
  });
});
