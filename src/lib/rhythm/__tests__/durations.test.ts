/** INV-005 and INV-043 (wire half): the duration table and what the wire accepts. */
import { describe, expect, it } from "vitest";
import { eventRowSchema } from "@/lib/sync/protocol";
import { DURATIONS, nextDuration, readDuration } from "../durations";

const D = ["w", "h", "q", "8", "16", "32"] as const;
const U = ["64", "", "Q", 7, true, undefined, null];

const row = (durationHint: unknown) => ({
  id: "00000000-0000-4000-8000-000000000001",
  bandId: "00000000-0000-4000-8000-000000000001",
  partId: "00000000-0000-4000-8000-000000000001",
  rank: "a0",
  kind: "notes",
  frets: {},
  techniques: {},
  repeat: 1,
  durationHint,
  tupletId: null,
  tupletCount: null,
  groupKind: null,
  updatedAt: "000000000000001:0000:a",
  deletedAt: null,
  fieldClocks: {},
  serverSeq: 0,
});

describe("durations", () => {
  it("reads each of the six to its table entry", () => {
    for (const id of D) expect(readDuration(id)).toBe(DURATIONS.find((d) => d.id === id));
  });
  it("reads anything else as unset", () => {
    for (const value of U) expect(readDuration(value)).toBeNull();
  });
  it("toggles: the same tap clears, another sets", () => {
    expect(nextDuration("q", "q")).toBeNull();
    expect(nextDuration("q", "8")).toBe("8");
    expect(nextDuration(null, "h")).toBe("h");
    expect(nextDuration("64", "q")).toBe("q");
  });
  it("matches the wire enum exactly", () => {
    for (const id of D) expect(eventRowSchema.safeParse(row(id)).success).toBe(true);
    for (const value of ["64", "", "Q", 7, true]) {
      expect(eventRowSchema.safeParse(row(value)).success).toBe(false);
    }
  });
});
