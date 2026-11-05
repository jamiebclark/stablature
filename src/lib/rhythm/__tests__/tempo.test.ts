/** INV-018 and INV-042: what counts as a usable tempo, pinned against the wire. */
import { describe, expect, it } from "vitest";
import { songRowSchema } from "@/lib/sync/protocol";
import { usableTempo } from "../tempo";

const song = (bpm: unknown) => ({
  id: "00000000-0000-4000-8000-000000000001",
  bandId: "00000000-0000-4000-8000-000000000001",
  title: "t",
  tuningId: null,
  bpm,
  notes: null,
  updatedAt: "000000000000001:0000:a",
  deletedAt: null,
  fieldClocks: {},
  serverSeq: 0,
});

describe("usableTempo", () => {
  it("is null for anything that is not a whole number from 1 to 999", () => {
    for (const v of [null, undefined, 0, -1, 1000, 120.5, NaN, "120"]) {
      expect(usableTempo(v)).toBeNull();
    }
  });
  it("is the number for whole numbers in range", () => {
    for (const v of [1, 19, 20, 120, 400, 401, 999]) expect(usableTempo(v)).toBe(v);
  });
  it("agrees with songRowSchema at the edges", () => {
    for (const v of [0, 1, 999, 1000, 120.5]) {
      expect(songRowSchema.safeParse(song(v)).success).toBe(usableTempo(v) !== null);
    }
  });
  it("every integer 20 to 400 passes the wire", () => {
    for (let v = 20; v <= 400; v += 1) expect(songRowSchema.safeParse(song(v)).success).toBe(true);
  });
});
