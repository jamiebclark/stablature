import { describe, expect, it } from "vitest";
import { IDLE, stepFretEntry, type FretInput } from "../fretEntry";

const run = (inputs: FretInput[], max = 24) => {
  let state = IDLE;
  const entered: number[] = [];
  for (const input of inputs) {
    const s = stepFretEntry(state, input, max);
    state = s.state;
    entered.push(...s.enters);
  }
  return { entered, state };
};
const d = (digit: number): FretInput => ({ type: "digit", digit });

describe("fret entry", () => {
  it("enters 0 and 3 to 9 at once", () => {
    expect(run([d(5), d(7), d(3), d(8), d(0)]).entered).toEqual([5, 7, 3, 8, 0]);
  });
  it("waits on 1 and 2, then pairs", () => {
    expect(run([d(1), d(2)]).entered).toEqual([12]);
    expect(run([d(2), d(4)]).entered).toEqual([24]);
    expect(run([d(1)]).state.waiting).toBe(1);
  });
  it("a pair above the neck enters two notes", () => {
    expect(run([d(2), d(5)]).entered).toEqual([2, 5]);
    expect(run([d(2), d(5), d(1)], 24).state.waiting).toBe(1);
    expect(run([d(2), d(5)], 12).entered).toEqual([2, 5]);
  });
  it("2 then 2 on a short neck", () => {
    expect(run([d(2), d(2), { type: "enter" }], 21).entered).toEqual([2, 2]);
  });
  it("Enter, a wait and another key flush the waiting digit", () => {
    for (const flush of [{ type: "enter" }, { type: "timeout" }, { type: "other" }] as FretInput[]) {
      const r = run([d(1), flush]);
      expect(r.entered).toEqual([1]);
      expect(r.state.waiting).toBeNull();
    }
  });
  it("Enter with nothing waiting enters nothing", () => {
    expect(run([{ type: "enter" }]).entered).toEqual([]);
  });
});
