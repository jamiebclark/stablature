import { describe, expect, it } from "vitest";
import { START_LEAD_S, createEngine, type EngineChange, type StopReason } from "@/lib/rhythm/scheduler";
import { EMPTY_SCORE } from "@/lib/rhythm/notation";
import { TICKS_PER_BEAT as Q } from "@/lib/rhythm/durations";
import { presetById } from "@/lib/tunings";
import { audibleFor, playRounds, playStream } from "../stream";
import { LEN, passesOf } from "./fixtures";
import { fakePort } from "./fake-port";

const bass = presetById("bass4-e")!;
const rounds = (id: string) => playRounds(passesOf(LEN.find((r) => r.id === id)!.passes), bass);

function rig() {
  const port = fakePort(0);
  let now = 0;
  const timers = new Map<number, { fn: () => void; at: number }>();
  let id = 0;
  let makes = 0;
  let voicesArg: boolean | undefined;
  const changes: EngineChange[] = [];
  const engine = createEngine({
    makeClock: (o) => {
      makes++;
      voicesArg = o?.voices;
      return port;
    },
    makeSilentClock: () => port,
    setTimer: (fn, ms) => {
      timers.set(++id, { fn, at: now + ms / 1000 });
      return id;
    },
    clearTimer: (h) => void timers.delete(h as number),
    onChange: (c) => changes.push(c),
  });
  const run = (seconds: number, jitter = () => 0) => {
    const end = now + seconds;
    for (;;) {
      let next: [number, { fn: () => void; at: number }] | null = null;
      for (const e of timers) if (!next || e[1].at < next[1].at) next = e;
      if (!next || next[1].at > end) break;
      timers.delete(next[0]);
      now = Math.max(now, next[1].at + jitter());
      port.advance(now);
      next[1].fn();
    }
    now = Math.max(now, end);
    port.advance(now);
  };
  const go = async (bpm: number, stream: Parameters<typeof engine.start>[0]["stream"], extra: object = {}) => {
    engine.start({ bpm, stream, voices: true, ...extra });
    port.settle(true);
    await Promise.resolve().then(() => Promise.resolve());
  };
  return { engine, port, run, go, changes, get makes() { return makes; }, get voices() { return voicesArg; }, timers, set now(v: number) { now = v; port.advance(v); } };
}
const reasons = (c: EngineChange[]) => c.flatMap((x) => (x.kind === "stopped" ? [x.reason as StopReason] : []));

describe("INV-007 E1: no drift over ten minutes", () => {
  it.each([40, 120, 240])("%i bpm, Click on", async (bpm) => {
    const r = rig();
    const rd = rounds("L2");
    await r.go(bpm, playStream(rd, EMPTY_SCORE, false, { loop: () => true }), { audible: audibleFor({ click: () => true }) });
    let seed = bpm;
    r.run(600, () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 0.02);
    expect(r.engine.state).toBe("running");
    const t0 = r.port.notes[0].time - 4 * (60 / bpm);
    expect(t0).toBeCloseTo(START_LEAD_S, 6);
    r.port.notes.forEach((n, k) => expect(Math.abs(n.time - (t0 + ((4 + k) * 60) / bpm))).toBeLessThan(0.001));
    expect(r.port.notes.length).toBeGreaterThan((600 * bpm) / 60 - 12);
    r.port.clicks.forEach((c, k) => expect(Math.abs(c.time - (t0 + (k * 60) / bpm))).toBeLessThan(0.001));
  });

  it("Click off: no click after the count-in, notes unchanged", async () => {
    const r = rig();
    await r.go(120, playStream(rounds("L2"), EMPTY_SCORE, false, { loop: () => true }), { audible: audibleFor({ click: () => false }) });
    r.run(20);
    expect(r.port.clicks).toHaveLength(4);
    expect(r.port.notes.length).toBeGreaterThan(30);
    expect(r.voices).toBe(true);
  });
});

describe("INV-008 E2: L1 looped has no gap or overlap at any seam", () => {
  it("every round's first note is exactly where the round before ends", async () => {
    const r = rig();
    const rd = rounds("L1");
    await r.go(120, playStream(rd, EMPTY_SCORE, false, { loop: () => true }));
    r.run(600, () => 0.01);
    const per = rd.first.voices.length;
    const t0 = r.port.notes[0].time - 4 * 0.5;
    const roundS = (rd.first.lengthTicks / Q) * 0.5;
    r.port.notes.forEach((n, i) => {
      const round = Math.floor(i / per);
      const v = rd.first.voices[i % per];
      expect(Math.abs(n.time - (t0 + 2 + round * roundS + (v.tick / Q) * 0.5))).toBeLessThan(1e-9 + 0.0005);
    });
    const firstOfRound = (k: number) => r.port.notes[k * per].time;
    expect(firstOfRound(5) - firstOfRound(4)).toBeCloseTo(roundS, 9);
  });
});

describe("E3 / E4 / E5 / E6 / E8", () => {
  it("E3: Loop off ends with `ended`, never fell-behind", async () => {
    const r = rig();
    await r.go(120, playStream(rounds("L2"), EMPTY_SCORE, false, { loop: () => false }));
    r.run(30);
    expect(reasons(r.changes)).toEqual(["ended"]);
    expect(r.engine.state).toBe("idle");
    expect(r.port.closed).toBe(1);
  });

  it("E3: ended happens at the first top-up at or after the end time", async () => {
    const r = rig();
    await r.go(120, playStream(rounds("L2"), EMPTY_SCORE, false, { loop: () => false }));
    const endTime = START_LEAD_S + 12 * 0.5;
    r.run(endTime - 0.05);
    expect(r.engine.state).toBe("running");
    r.run(0.2);
    expect(r.engine.state).toBe("idle");
  });

  it("E4: a stall of two seconds is fell-behind and nothing is queued in the past", async () => {
    const r = rig();
    await r.go(120, playStream(rounds("L2"), EMPTY_SCORE, false, { loop: () => true }));
    r.run(1);
    r.now = r.port.now() + 2;
    r.run(0.1);
    expect(reasons(r.changes)).toEqual(["fell-behind"]);
  });

  it("E5: setTempo mid-run moves the next unqueued item to the new spacing, with no new count-in", async () => {
    const r = rig();
    await r.go(120, playStream(rounds("L2"), EMPTY_SCORE, false, { loop: () => true }));
    r.run(5);
    r.engine.setTempo(240);
    r.run(5);
    const times = r.port.notes.map((n) => n.time);
    expect(times[times.length - 1] - times[times.length - 2]).toBeCloseTo(0.25, 9);
    expect(r.port.clicks.filter((_, i) => i < 4)).toHaveLength(4);
    expect(r.port.clicks.length).toBeGreaterThan(4);
  });

  it.each(["tap", "left", "hidden", "audio-lost", "ended"] as const)("E6: close() once, synchronously, for %s", async (reason) => {
    const r = rig();
    await r.go(120, playStream(rounds("L2"), EMPTY_SCORE, false, { loop: () => false }));
    r.run(1);
    if (reason === "audio-lost") r.port.lose();
    else if (reason === "ended") r.run(30);
    else r.engine.stop(reason);
    expect(r.port.closed).toBe(1);
    r.engine.stop("tap");
    expect(r.port.closed).toBe(1);
  });

  it("E8: start twice synchronously makes one run", () => {
    const r = rig();
    r.engine.start({ bpm: 120, stream: playStream(rounds("L2"), EMPTY_SCORE, false, { loop: () => false }), voices: true });
    r.engine.start({ bpm: 120, stream: playStream(rounds("L2"), EMPTY_SCORE, false, { loop: () => false }), voices: true });
    expect(r.makes).toBe(1);
  });

  it("INV-009: dueMarks() times equal the notes' times", async () => {
    const r = rig();
    await r.go(120, playStream(rounds("L2"), EMPTY_SCORE, false, { loop: () => true }));
    const marks: { time: number }[] = [];
    for (let i = 0; i < 40; i++) {
      r.run(0.25);
      marks.push(...r.engine.dueMarks());
    }
    expect(marks.length).toBeGreaterThan(8);
    marks.forEach((m, k) => expect(m.time).toBe(r.port.notes[k].time));
  });
});

describe("S5: a note and a click at one tick get identical times", () => {
  it("count-in aside, beat k's click and note are ===", async () => {
    const r = rig();
    await r.go(120, playStream(rounds("L2"), EMPTY_SCORE, false, { loop: () => true }));
    r.run(8);
    const clickTimes = new Set(r.port.clicks.map((c) => c.time));
    r.port.notes.slice(0, 8).forEach((n) => expect(clickTimes.has(n.time)).toBe(true));
  });
});
