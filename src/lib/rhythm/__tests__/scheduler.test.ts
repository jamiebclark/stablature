import { describe, expect, it } from "vitest";
import type { ClickClock } from "../audio";
import { TICKS_PER_BEAT } from "../durations";
import type { ClickLevel } from "../notation";
import {
  AUDIO_START_TIMEOUT_MS,
  START_LEAD_S,
  TOP_UP_MS,
  createEngine,
  type EngineChange,
  type StopReason,
} from "../scheduler";
import { EMPTY_SCORE } from "../notation";
import { clickStream } from "../stream";

function rig(opts: { ready?: boolean | "never" } = {}) {
  let now = 0;
  const scheduled: { time: number; level: ClickLevel }[] = [];
  let closes = 0;
  let lostListener: (() => void) | null = null;
  const timers = new Map<number, { fn: () => void; at: number }>();
  let timerId = 0;
  const clock: ClickClock = {
    now: () => now,
    audible: true,
    ready: () =>
      opts.ready === "never" ? new Promise(() => {}) : Promise.resolve(opts.ready ?? true),
    schedule: (time, level) => scheduled.push({ time, level }),
    close: () => {
      closes++;
    },
    onLost: (l) => {
      lostListener = l;
    },
  };
  const changes: EngineChange[] = [];
  const clocks: ClickClock[] = [];
  const engine = createEngine({
    makeClock: () => {
      clocks.push(clock);
      return clock;
    },
    makeSilentClock: () => ({ ...clock, audible: false, schedule() {}, close() {} }),
    setTimer: (fn, ms) => {
      const id = ++timerId;
      timers.set(id, { fn, at: now + ms / 1000 });
      return id;
    },
    clearTimer: (h) => void timers.delete(h as number),
    onChange: (c) => changes.push(c),
  });
  /** Advance the fake time in timer steps, with jitter added to each firing. */
  const run = (seconds: number, jitter = () => 0) => {
    const end = now + seconds;
    for (;;) {
      let next: [number, { fn: () => void; at: number }] | null = null;
      for (const e of timers) if (!next || e[1].at < next[1].at) next = e;
      if (!next || next[1].at > end) break;
      timers.delete(next[0]);
      now = Math.max(now, next[1].at + jitter());
      next[1].fn();
    }
    now = Math.max(now, end);
  };
  const flush = () => Promise.resolve().then(() => Promise.resolve());
  return {
    engine, scheduled, changes, timers, clocks,
    get closes() { return closes; },
    get now() { return now; },
    set now(v: number) { now = v; },
    run, flush,
    lose: () => lostListener?.(),
  };
}

const reasons = (c: EngineChange[]) =>
  c.flatMap((x) => (x.kind === "stopped" ? [x.reason as StopReason] : []));
const go = async (r: ReturnType<typeof rig>, bpm: number) => {
  r.engine.start({ bpm, stream: clickStream(EMPTY_SCORE, false) });
  await r.flush();
};

describe("click engine", () => {
  it.each([40, 120, 240])("keeps time at %i bpm with timer jitter over ten minutes", async (bpm) => {
    const r = rig();
    await go(r, bpm);
    let seed = bpm;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 0.2;
    r.run(600, rand);
    expect(r.engine.state).toBe("running");
    const t0 = r.scheduled[0].time;
    expect(t0).toBeCloseTo(START_LEAD_S, 6);
    r.scheduled.forEach((s, k) => expect(Math.abs(s.time - (t0 + (k * 60) / bpm))).toBeLessThan(0.001));
    expect(r.scheduled.length).toBeGreaterThan((600 * bpm) / 60 - 2);
  });

  it("a 200 ms stall moves or drops nothing", async () => {
    const r = rig();
    await go(r, 120);
    r.run(1);
    r.now += 0.2;
    r.run(2);
    expect(r.engine.state).toBe("running");
    const t0 = r.scheduled[0].time;
    r.scheduled.forEach((s, k) => expect(s.time).toBeCloseTo(t0 + k * 0.5, 6));
  });

  it("stop is synchronous, empties queues, and a later start counts from one", async () => {
    const r = rig();
    await go(r, 120);
    r.run(0.1);
    r.engine.stop("tap");
    expect(r.closes).toBe(1);
    expect(r.timers.size).toBe(0);
    expect(r.engine.state).toBe("idle");
    expect(r.engine.due()).toEqual([]);
    r.scheduled.length = 0;
    const before = r.now;
    await go(r, 120);
    r.run(0.1);
    expect(r.scheduled[0].time).toBeCloseTo(before + START_LEAD_S, 6);
    const due = (r.run(5), r.engine.due());
    expect(due[0].count).toBe(1);
  });

  it("100 seeded random stops leave nothing running", async () => {
    let seed = 7;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 100; i++) {
      const r = rig();
      await go(r, 60 + Math.floor(rand() * 180));
      r.run(rand() * 3);
      r.engine.stop("tap");
      expect(r.timers.size).toBe(0);
      expect(r.engine.state).toBe("idle");
      expect(r.closes).toBe(1);
    }
  });

  it("a double start, and start/stop/start in one tick", async () => {
    const r = rig();
    r.engine.start({ bpm: 120, stream: clickStream(EMPTY_SCORE, false) });
    r.engine.start({ bpm: 120, stream: clickStream(EMPTY_SCORE, false) });
    expect(r.clocks.length).toBe(1);
    r.engine.stop("tap");
    r.engine.start({ bpm: 120, stream: clickStream(EMPTY_SCORE, false) });
    await r.flush();
    expect(r.clocks.length).toBe(2);
    expect(r.engine.state).toBe("running");
    r.run(0.1);
    expect(r.scheduled[0].time).toBeCloseTo(START_LEAD_S, 6);
  });

  it("stop while starting does nothing further", async () => {
    const r = rig();
    r.engine.start({ bpm: 120, stream: clickStream(EMPTY_SCORE, false) });
    r.engine.stop("tap");
    await r.flush();
    expect(r.engine.state).toBe("idle");
    expect(r.scheduled).toEqual([]);
  });

  it("falls behind when the clock jumps past a queued time", async () => {
    const r = rig();
    await go(r, 120);
    r.now += 3;
    r.run(0.05);
    expect(r.engine.state).toBe("idle");
    expect(reasons(r.changes)).toEqual(["fell-behind"]);
  });

  it.each([
    [240, 60],
    [60, 240],
    [10, 120],
  ])("tempo change %i to %i keeps queued clicks and does not fall behind", async (a, b) => {
    const r = rig();
    await go(r, a);
    r.run(0.1);
    const queued = r.scheduled.map((s) => s.time);
    r.engine.setTempo(b);
    expect(r.scheduled.map((s) => s.time)).toEqual(queued);
    r.run(30);
    expect(r.engine.state).toBe("running");
    const times = r.scheduled.map((s) => s.time);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
    const late = times.slice(queued.length + 1);
    for (let i = 1; i < late.length; i++) expect(late[i] - late[i - 1]).toBeCloseTo(60 / b, 6);
  });

  it("the same tempo does nothing", async () => {
    const r = rig();
    await go(r, 120);
    r.run(0.1);
    r.engine.setTempo(120);
    r.run(2);
    const t0 = r.scheduled[0].time;
    r.scheduled.forEach((s, k) => expect(s.time).toBeCloseTo(t0 + k * 0.5, 6));
  });

  it("a dry queue stops with a reason", async () => {
    const r = rig();
    r.engine.start({ bpm: 120, stream: [][Symbol.iterator]() });
    await r.flush();
    expect(reasons(r.changes)).toEqual(["fell-behind"]);
  });

  it("a clock that never gets ready goes silent after the timeout", async () => {
    const r = rig({ ready: "never" });
    r.engine.start({ bpm: 120, stream: clickStream(EMPTY_SCORE, false) });
    r.run(AUDIO_START_TIMEOUT_MS / 1000 + 0.01);
    expect(r.engine.state).toBe("running");
    expect(r.changes.some((c) => c.kind === "soundless")).toBe(true);
  });

  it("audio lost stops with a reason", async () => {
    const r = rig();
    await go(r, 120);
    r.lose();
    expect(reasons(r.changes)).toEqual(["audio-lost"]);
  });

  it("due returns clicks in order once their time has come", async () => {
    const r = rig();
    await go(r, 120);
    r.run(0.2);
    expect(r.engine.due().map((c) => c.count)).toEqual([1]);
    expect(r.engine.due()).toEqual([]);
    r.run(TOP_UP_MS / 1000 + 1.1);
    expect(r.engine.due().map((c) => c.count)).toEqual([2, 3]);
    void TICKS_PER_BEAT;
  });
});
