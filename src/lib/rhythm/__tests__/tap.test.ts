/** INV-013: the tap reducer, exact readings from tap times. */
import { describe, expect, it } from "vitest";
import { addTap, EMPTY_RUN, readTaps, type TapRun } from "../tap";

const run = (times: number[]): TapRun => times.reduce(addTap, EMPTY_RUN);
const every = (gap: number, n: number, from = 1000) => Array.from({ length: n }, (_, i) => from + i * gap);

describe("tap reducer", () => {
  it("waits at 1 and 2 taps, reads at 3", () => {
    expect(readTaps(run(every(500, 1)))).toEqual({ kind: "waiting", tapsNeeded: 2 });
    expect(readTaps(run(every(500, 2)))).toEqual({ kind: "waiting", tapsNeeded: 1 });
    expect(readTaps(EMPTY_RUN)).toEqual({ kind: "waiting", tapsNeeded: 3 });
    expect(readTaps(run(every(500, 3)))).toEqual({ kind: "reading", bpm: 120 });
  });
  it("keeps the last nine taps", () => {
    const times = [...every(1000, 12), ...[]];
    expect(run(every(500, 20)).taps).toHaveLength(9);
    expect(run(times).taps).toHaveLength(9);
    expect(readTaps(run(every(500, 9)))).toEqual({ kind: "reading", bpm: 120 });
  });
  it("restarts on a gap over 3000 ms, not at 3000", () => {
    expect(run([0, 2000, 4000, 7000]).taps).toHaveLength(4);
    expect(run([0, 2000, 4000, 7001]).taps).toEqual([7001]);
  });
  it("restarts on an interval under half or over double the mean", () => {
    expect(run([0, 500, 1000, 1250]).taps).toHaveLength(4);
    expect(run([0, 500, 1000, 2000]).taps).toHaveLength(4);
    expect(run([0, 500, 1000, 1249]).taps).toEqual([1249]);
    expect(run([0, 500, 1000, 2001]).taps).toEqual([2001]);
  });
  it("reads the range edges", () => {
    expect(readTaps(run(every(150, 3)))).toEqual({ kind: "reading", bpm: 400 });
    expect(readTaps(run(every(149, 3)))).toEqual({ kind: "out-of-range", bpm: 403 });
    expect(readTaps(run(every(3000, 3)))).toEqual({ kind: "reading", bpm: 20 });
  });
  it("says tooSlow for two taps more than 3 s apart", () => {
    const r = run([0, 3500]);
    expect(r.tooSlow).toBe(true);
    expect(readTaps(r)).toEqual({ kind: "out-of-range", bpm: null });
    expect(run([0, 3500, 3900]).tooSlow).toBe(false);
  });
  it("ignores a time not later than the last tap", () => {
    const r = run([0, 500]);
    expect(addTap(r, 500)).toBe(r);
    expect(addTap(r, 100)).toBe(r);
  });
  it("stays within 2 bpm of 120 under ±15 ms jitter", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 30 - 15;
    const times = every(500, 8).map((t) => t + rnd());
    const r = readTaps(run(times));
    expect(r.kind).toBe("reading");
    if (r.kind === "reading") expect(Math.abs(r.bpm - 120)).toBeLessThanOrEqual(2);
  });
});
