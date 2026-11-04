import { describe, expect, it } from "vitest";
import type { EventRow } from "@/lib/model";
import { nextCursorAfterDelete } from "../cursor";

const syncMeta = { updatedAt: "", deletedAt: null, fieldClocks: {}, serverSeq: 0 } as const;

function event(id: string): EventRow {
  return {
    ...syncMeta,
    id,
    bandId: "band-1",
    partId: "part-1",
    rank: id,
    kind: "notes",
    frets: {},
    techniques: {},
    repeat: 1,
    durationHint: null,
    tupletId: null,
    tupletCount: null,
  };
}

const a = event("a");
const b = event("b");
const c = event("c");
const columns = [a, b, c];

describe("nextCursorAfterDelete", () => {
  it("keeps tracking the tail when the cursor is end", () => {
    expect(nextCursorAfterDelete(columns, b.id, "end")).toBe("end");
  });

  it("moves to the previous column when the deleted column had one", () => {
    expect(nextCursorAfterDelete(columns, b.id, b.id)).toBe(a.id);
  });

  it("moves to the start when the deleted column was first", () => {
    expect(nextCursorAfterDelete(columns, a.id, a.id)).toBe(null);
  });

  it("leaves the cursor unchanged when it is on some other column", () => {
    expect(nextCursorAfterDelete(columns, b.id, c.id)).toBe(c.id);
  });
});
