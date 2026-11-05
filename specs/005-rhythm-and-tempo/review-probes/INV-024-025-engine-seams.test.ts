/**
 * What `run-mutants.sh` showed neither `scheduler.test.ts` nor `stream.test.ts` can see: an old run's
 * clock answering after a new run began, the swap to the silent clock, the first gap after a tempo
 * move, and `follow` off over a score that has clicks.
 */
import { describe, expect, it } from "vitest";
import type { ClickClock } from "@/lib/rhythm/audio";
import { TICKS_PER_BEAT } from "@/lib/rhythm/durations";
import type { Score } from "@/lib/rhythm/notation";
import { createEngine } from "@/lib/rhythm/scheduler";
import { clickStream } from "@/lib/rhythm/stream";

interface Fake extends ClickClock {
  times: number[];
  closed: number;
  lose: () => void;
  settle: (ready: boolean) => void;
}

function rig() {
  let now = 10;
  const made: Fake[] = [];
  const silent: Fake[] = [];
  const timers = new Map<number, { fn: () => void; at: number }>();
  let id = 0;
  const fake = (): Fake => {
    let settle!: (ready: boolean) => void;
    const ready = new Promise<boolean>((res) => (settle = res));
    let lost = () => {};
    const clock: Fake = {
      now: () => now,
      audible: true,
      ready: () => ready,
      schedule(time) {
        clock.times.push(time);
      },
      close() {
        clock.closed += 1;
      },
      onLost(fn) {
        lost = fn;
      },
      times: [],
      closed: 0,
      lose: () => lost(),
      settle: (r) => settle(r),
    };
    return clock;
  };
  const engine = createEngine({
    makeClock: () => {
      made.push(fake());
      return made[made.length - 1];
    },
    makeSilentClock: () => {
      silent.push(fake());
      return silent[silent.length - 1];
    },
    setTimer: (fn, ms) => {
      timers.set(++id, { fn, at: now + ms / 1000 });
      return id;
    },
    clearTimer: (h) => void timers.delete(h as number),
  });
  const run = (until: number) => {
    for (;;) {
      let next: [number, { fn: () => void; at: number }] | null = null;
      for (const e of timers) if (!next || e[1].at < next[1].at) next = e;
      if (!next || next[1].at > until) break;
      timers.delete(next[0]);
      now = next[1].at;
      next[1].fn();
    }
    now = until;
  };
  const flush = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  return { engine, made, silent, run, flush };
}

const plain = () => clickStream({ clicks: [], lengthTicks: 0, timedFromStart: false }, false);

describe("INV-024 an old run's clock cannot reach a new run", () => {
  it("a stale ready does not begin the new run early", async () => {
    const r = rig();
    r.engine.start({ bpm: 120, stream: plain() });
    r.engine.stop("tap");
    r.engine.start({ bpm: 120, stream: plain() });
    r.made[0].settle(true);
    await r.flush();
    expect(r.engine.state).toBe("starting");
    expect(r.made[1].times).toEqual([]);
    r.made[1].settle(true);
    await r.flush();
    expect(r.engine.state).toBe("running");
    expect(r.made[1].times.length).toBeGreaterThan(0);
    expect(r.made[0].times).toEqual([]);
  });

  it("a stale refusal does not silence the new run, and leaves no clock open", async () => {
    const r = rig();
    r.engine.start({ bpm: 120, stream: plain() });
    r.engine.stop("tap");
    r.engine.start({ bpm: 120, stream: plain() });
    r.made[0].settle(false);
    await r.flush();
    expect(r.silent).toEqual([]);
    expect(r.made[1].closed).toBe(0);
  });

  it("a stale loss does not stop the new run", async () => {
    const r = rig();
    r.engine.start({ bpm: 120, stream: plain() });
    r.made[0].settle(true);
    await r.flush();
    r.engine.stop("tap");
    r.engine.start({ bpm: 120, stream: plain() });
    r.made[1].settle(true);
    await r.flush();
    r.made[0].lose();
    expect(r.engine.state).toBe("running");
  });
});

describe("INV-027 a clock that will not start", () => {
  it("the run moves to the silent clock and leaves the real one closed", async () => {
    const r = rig();
    r.engine.start({ bpm: 120, stream: plain() });
    r.made[0].settle(false);
    await r.flush();
    r.run(12);
    expect(r.engine.state).toBe("running");
    expect(r.silent).toHaveLength(1);
    expect(r.silent[0].times.length).toBeGreaterThan(0);
    expect(r.made[0].times).toEqual([]);
    expect(r.made[0].closed).toBe(1);
  });
});

describe("INV-025 the first click not yet queued", () => {
  for (const [from, to] of [
    [240, 60],
    [60, 240],
    [120, 121],
  ]) {
    it(`${from} to ${to}: one beat of the new tempo after the last queued click`, async () => {
      const r = rig();
      r.engine.start({ bpm: from, stream: plain() });
      r.made[0].settle(true);
      await r.flush();
      r.run(12);
      const queued = r.made[0].times.length;
      const last = r.made[0].times[queued - 1];
      r.engine.setTempo(to);
      r.run(12 + (60 / to) * 3 + 1);
      const next = r.made[0].times[queued];
      expect(Math.abs(next - last - 60 / to)).toBeLessThan(0.05 + 1e-9);
    });
  }
});

describe("INV-038 follow off, over a score with clicks", () => {
  it("is count-in then plain on the beat, and no following at all", () => {
    const score: Score = {
      clicks: [
        { tick: 0, level: "accent" },
        { tick: TICKS_PER_BEAT / 2, level: "soft" },
      ],
      lengthTicks: TICKS_PER_BEAT,
      timedFromStart: true,
    };
    const stream = clickStream(score, false);
    const got = Array.from({ length: 8 }, () => stream.next().value);
    expect(got.filter((c) => c.phase === "following")).toEqual([]);
    expect(got.map((c) => c.tick / TICKS_PER_BEAT)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(got.every((c) => c.level === "beat")).toBe(true);
  });
});
