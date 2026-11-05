import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventRow } from "@/lib/model";
import { DECORATIONS } from "@/lib/tab/techniques";
import { TUNING_PRESETS as PRESETS } from "@/lib/tunings";

const toggleDecoration = vi.fn(async () => {});
vi.mock("@/lib/local/editing", () => ({
  bumpColumnRepeat: vi.fn(),
  setChord: vi.fn(),
  deleteColumn: vi.fn(),
  toggleDecoration,
}));

const { COLUMN_PROPERTIES, propertiesFor } = await import("../properties");

const syncMeta = { updatedAt: "", deletedAt: null, fieldClocks: {}, serverSeq: 0 } as const;
const row = (over: Partial<EventRow> = {}): EventRow => ({
  ...syncMeta,
  id: "e1",
  bandId: "b",
  partId: "p",
  rank: "a",
  kind: "notes",
  frets: { "2": 5, "3": 7 },
  techniques: { "3": ["vibrato"] },
  repeat: 1,
  durationHint: null,
  tupletId: null,
  tupletCount: null,
  ...over,
});
const preset = (name: string) => {
  const found = PRESETS.find((p) => p.id === name);
  if (!found) throw new Error(name);
  return found;
};
const decorations = COLUMN_PROPERTIES.find((p) => p.id === "decorations");

beforeEach(() => toggleDecoration.mockClear());

describe("decorations property (INV-025)", () => {
  it("applies to a playable column with a note, not a barline or empty space", () => {
    const playable = { kind: "playable", event: row() } as const;
    expect(propertiesFor(playable).map((p) => p.id)).toEqual(["repeat", "chord", "decorations", "duration", "delete"]);
    const empty = { kind: "playable", event: row({ frets: {}, techniques: {} }) } as const;
    expect(propertiesFor(empty).map((p) => p.id)).not.toContain("decorations");
    const barline = { kind: "barline", event: row({ kind: "barline", frets: {} }) } as const;
    expect(propertiesFor(barline).map((p) => p.id)).not.toContain("decorations");
  });

  it("yields one group per played string, six toggles in DECORATIONS order", () => {
    const tuning = preset("guitar6-e");
    const ctx = { part: { id: "p", bandId: "b" }, event: row(), annotations: [], tuning };
    const groups = decorations!.toggles!(ctx);
    expect(groups.map((g) => g.stringIndex)).toEqual([2, 3]);
    for (const g of groups) {
      expect(g.toggles.map((t) => t.value.decoration)).toEqual(DECORATIONS.map((d) => d.id));
    }
    expect(groups[1].toggles.map((t) => t.on)).toEqual([true, false, false, false, false, false]);
    const labels = groups.flatMap((g) => g.toggles.map((t) => t.ariaLabel));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("keeps aria labels unique on two E strings, and commits the id", async () => {
    const tuning = PRESETS.find((p) => p.family === "Guitar 6")!;
    const ev = row({ frets: { "0": 1, "5": 2 }, techniques: {} });
    const ctx = { part: { id: "p", bandId: "b" }, event: ev, annotations: [], tuning };
    const groups = decorations!.toggles!(ctx);
    const labels = groups.flatMap((g) => g.toggles.map((t) => t.ariaLabel));
    expect(new Set(labels).size).toBe(12);
    await decorations!.commit(ctx, groups[1].toggles[2].value);
    expect(toggleDecoration).toHaveBeenCalledWith("e1", 5, "let_ring");
  });
});
