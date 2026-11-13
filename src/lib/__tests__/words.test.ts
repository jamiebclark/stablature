import { describe, expect, it } from "vitest";
import { songCountWords } from "../words";

describe("songCountWords (INV-017)", () => {
  it.each([
    [0, "No songs yet"],
    [1, "1 song"],
    [2, "2 songs"],
    [3, "3 songs"],
  ])("%i -> %s", (n, expected) => {
    expect(songCountWords(n)).toBe(expected);
  });
});
