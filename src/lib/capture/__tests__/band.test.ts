import { describe, expect, it } from "vitest";
import { anchorFor, bandLines, bandWraps } from "../band";

describe("bandLines", () => {
  it("fits exactly two lines with a gap between", () => {
    expect(bandLines(2 * 100 + 12, 100, 12)).toBe(2);
    expect(bandWraps(212, 100, 12)).toBe(true);
  });
  it("does not fit two lines 0.1px short", () => {
    expect(bandLines(211.9, 100, 12)).toBe(1);
    expect(bandWraps(211.9, 100, 12)).toBe(false);
  });
  it("is 0 when the line is 0", () => {
    expect(bandLines(500, 0, 12)).toBe(0);
    expect(bandWraps(500, 0, 12)).toBe(false);
  });
  it("works with no gap", () => {
    expect(bandLines(300, 100, 0)).toBe(3);
  });
});

describe("anchorFor", () => {
  const band = 300;
  it("gives runway when the cursor is on the first line", () => {
    expect(anchorFor({ band, contentHeight: 900, lineBottom: 100 })).toEqual({
      runway: 200,
      overflows: true,
    });
  });
  it("gives none on the last line", () => {
    expect(anchorFor({ band, contentHeight: 900, lineBottom: 900 })).toEqual({
      runway: 0,
      overflows: true,
    });
  });
  it("gives none on a middle line deep enough to scroll", () => {
    expect(anchorFor({ band, contentHeight: 900, lineBottom: 500 }).runway).toBe(0);
  });
  it("gives none when the part fits whole", () => {
    expect(anchorFor({ band, contentHeight: 250, lineBottom: 100 })).toEqual({
      runway: 0,
      overflows: false,
    });
  });
});
