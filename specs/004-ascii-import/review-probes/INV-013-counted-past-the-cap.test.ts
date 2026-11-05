/**
 * Round 2. INV-013: never does a run merge beyond the rule, or stop short of it.
 *          INV-003: never does text the export wrote come back as different events.
 *
 * Round 1's F8 fix caps the spend. The rule (reader.md section 10) still says: spend the excess,
 * so a counted group stores its number of columns unless the runs cannot save that much. A run
 * over 512 saves by splitting into chunks, as the plain path does, not by leaving ones behind.
 */
import { describe, expect, it } from "vitest";
import { draftPart } from "@/lib/local/clipboard";
import { MAX_REPEAT } from "@/lib/model";
import { toAscii } from "@/lib/tab/ascii";
import { presetById } from "@/lib/tunings";
import { clip, four } from "./unit-helpers";

const tuning = presetById("bass4-e")!;
const body = (n: number) => `-${"5-".repeat(n)}`;

const counted = (drawn: number, count: number) => {
  const notes = body(drawn);
  const width = notes.length - 2;
  const digits = String(count);
  const left = Math.floor((width - digits.length - 2) / 2);
  const right = width - digits.length - 2 - left;
  return `    ,${"-".repeat(left)}${digits}${"-".repeat(right)},\n${four(notes)}`;
};

const repeats = (text: string) => clip(text).clipboard.columns.map((c) => c.repeat);

describe("INV-013 a counted run past the cap", () => {
  it.each([
    [512, 3],
    [513, 3],
    [520, 3],
    [1030, 3],
    [1030, 16],
  ])("%i drawn under a count of %i stores that many columns", (drawn, count) => {
    const stored = repeats(counted(drawn, count));
    expect(stored.every((r) => r >= 1 && r <= MAX_REPEAT)).toBe(true);
    expect(stored.reduce((a, b) => a + b, 0)).toBe(drawn);
    expect(stored.length).toBe(count);
  });

  it("a count the cap cannot reach merges nothing, as any other partial saving", () => {
    // 1,030 cannot fit in two columns of at most 512, so the runs cannot save the excess.
    const stored = repeats(counted(1030, 2));
    expect(stored.every((r) => r === 1)).toBe(true);
    expect(stored.length).toBe(1030);
  });
});

describe("INV-003 the app's own group of two stored 512s", () => {
  it("comes back as the two columns it was", () => {
    const column = (id: string) => ({
      id,
      bandId: "b",
      partId: "p",
      rank: id,
      kind: "notes",
      frets: { "0": 5 },
      techniques: {},
      repeat: 512,
      durationHint: null,
      tupletId: "g",
      tupletCount: 2,
      groupKind: "tuplet",
      updatedAt: "x",
      deletedAt: null,
      fieldClocks: {},
      serverSeq: 0,
    });
    const text = toAscii({
      events: [column("a"), column("b")] as never,
      tuning,
      density: "expanded",
    });
    expect(draftPart(clip(text).clipboard).events.map((e) => e.repeat)).toEqual([512, 512]);
  });
});
