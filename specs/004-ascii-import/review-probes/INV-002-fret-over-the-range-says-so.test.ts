/**
 * Round 7, MINOR F67. T084 and reader.md section 5 say fret text that OPENS on a zero is
 * `run-together`, and fret text above 36 is `fret-range`. parse.ts line 212 tests for a zero then a
 * digit anywhere in the cell, so `100`, `105` and `205`, which do not open on a zero, get the first.
 * Each still refuses, so this is the reason and not the outcome. The guards keep what T084 asked.
 */
import { describe, expect, it } from "vitest";
import { codes, four } from "./unit-helpers";

describe("INV-002 fret text over the range says so", () => {
  it.each(["37", "57", "99", "100", "105", "205", "1000"])("%s", (cell) => {
    expect(codes(four(`-${cell}-`))).toEqual(["fret-range"]);
  });
});

describe("INV-002 fret text opening on a zero stays run-together", () => {
  it.each(["00", "05", "012", "(00)", "t00", "00x3"])("%s", (cell) => {
    expect(codes(four(`-${cell}-`))).toEqual(["run-together"]);
  });
});
