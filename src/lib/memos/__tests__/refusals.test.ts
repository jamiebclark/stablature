import { describe, expect, it } from "vitest";
import { READ_ONLY_MESSAGE } from "../../sync/protocol";
import { REFUSALS } from "../refusals";

const EXPECTED: Record<string, number> = {
  signed_out: 401,
  not_found: 404,
  not_uploaded: 404,
  read_only: 403,
  format: 415,
  format_mismatch: 415,
  too_large: 413,
  size_mismatch: 422,
  content_mismatch: 422,
  incomplete: 400,
  deleted: 410,
  erased: 410,
  part_deleted: 410,
  different_file: 409,
  band_full: 507,
};

describe("REFUSALS", () => {
  it("has exactly the 15 non-success codes with their statuses", () => {
    expect(Object.keys(REFUSALS).sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const [code, status] of Object.entries(EXPECTED)) {
      expect(REFUSALS[code as keyof typeof REFUSALS].status).toBe(status);
    }
  });

  it("read_only uses the push's own words", () => {
    expect(REFUSALS.read_only.message).toBe(READ_ONLY_MESSAGE);
    expect(READ_ONLY_MESSAGE).toBe("You have read-only access to that band.");
  });

  it("has the contract's words for the memo-specific answers", () => {
    expect(REFUSALS.not_found.message).toBe("That memo is not on the server.");
    expect(REFUSALS.erased.message).toBe("This memo's audio was deleted.");
    expect(REFUSALS.band_full.message).toContain("500 MB");
  });
});
