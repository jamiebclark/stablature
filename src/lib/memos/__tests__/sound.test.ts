import { beforeEach, describe, expect, it, vi } from "vitest";
import { claim, current, release, resetSound } from "../sound";

/** INV-010, unit half: one sound at a time, over every ordered pair of owners. */
const OWNERS = ["memo:A", "memo:B", "recorder"] as const;

describe("one sound at a time", () => {
  beforeEach(resetSound);

  for (const first of OWNERS) {
    for (const second of OWNERS) {
      if (first === second) continue;
      it(`${first} then ${second}: the first stops before claim returns`, () => {
        const stopFirst = vi.fn();
        const stopSecond = vi.fn();
        claim(first, stopFirst);
        claim(second, stopSecond);
        expect(stopFirst).toHaveBeenCalledTimes(1);
        expect(stopSecond).not.toHaveBeenCalled();
        expect(current()).toBe(second);
      });
    }
  }

  it("claiming again as the same owner does not stop it", () => {
    const stop = vi.fn();
    claim("memo:A", stop);
    claim("memo:A", stop);
    expect(stop).not.toHaveBeenCalled();
  });

  it("release only works for the current owner", () => {
    claim("memo:A", () => {});
    release("memo:B");
    expect(current()).toBe("memo:A");
    release("memo:A");
    expect(current()).toBeNull();
  });
});
