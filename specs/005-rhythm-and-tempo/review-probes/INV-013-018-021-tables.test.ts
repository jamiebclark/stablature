/**
 * The literal tables, and the engine over what its own test leaves out.
 * INV-013: the plan's list, exact. INV-018, INV-042, INV-043: the wire, by value.
 * INV-021, INV-023, INV-025: ten simulated minutes following a score with tuplets, stalls in every
 * stage, a dry queue, and a tempo moved at every stage.
 */
import { describe, expect, it } from "vitest";
import { eventRowSchema, songRowSchema } from "@/lib/sync/protocol";
import type { ClickClock } from "@/lib/rhythm/audio";
import { readDuration, TICKS_PER_BEAT } from "@/lib/rhythm/durations";
import { readNotation, type ClickLevel, type StreamClick } from "@/lib/rhythm/notation";
import { createEngine, type EngineChange } from "@/lib/rhythm/scheduler";
import { clickStream } from "@/lib/rhythm/stream";
import { addTap, EMPTY_RUN, readTaps } from "@/lib/rhythm/tap";
import { usableTempo } from "@/lib/rhythm/tempo";
import type { EventRow } from "@/lib/model";

const after = (taps: number[]) => readTaps(taps.reduce(addTap, EMPTY_RUN));
const every = (ms: number, n: number, from = 1000) => Array.from({ length: n }, (_, i) => from + i * ms);

describe("INV-013 the tap rules", () => {
  it("reads nothing at 1 and 2 taps, and reads at 3", () => {
    expect(after([])).toEqual({ kind: "waiting", tapsNeeded: 3 });
    expect(after([1000])).toEqual({ kind: "waiting", tapsNeeded: 2 });
    expect(after([1000, 1500])).toEqual({ kind: "waiting", tapsNeeded: 1 });
    expect(after([1000, 1500, 2000])).toEqual({ kind: "reading", bpm: 120 });
  });

  it("uses the last eight intervals at 9 and at 20 taps", () => {
    // Nine taps: eight intervals. Twenty: drifting slower, so only the last eight can give this.
    expect(after(every(500, 9))).toEqual({ kind: "reading", bpm: 120 });
    const drift: number[] = [1000];
    for (let i = 1; i < 20; i++) drift.push(drift[i - 1] + (i <= 11 ? 500 : 520));
    expect(after(drift)).toEqual({ kind: "reading", bpm: Math.round(60000 / 520) });
  });

  it("a gap of 3,000 stays, and 3,001 restarts from that tap", () => {
    expect(after([0 + 1, 3001, 6001])).toEqual({ kind: "reading", bpm: 20 });
    expect(after([1000, 1500, 2000, 5001])).toEqual({ kind: "waiting", tapsNeeded: 2 });
    expect(after([1000, 1500, 2000, 5000])).toEqual({ kind: "waiting", tapsNeeded: 2 });
  });

  it("an interval of exactly half or double stays, either side restarts", () => {
    const base = [1000, 2000, 3000];
    expect(after([...base, 3500]).kind).toBe("reading");
    expect(after([...base, 3499])).toEqual({ kind: "waiting", tapsNeeded: 2 });
    expect(after([...base, 5000]).kind).toBe("reading");
    expect(after([...base, 5001])).toEqual({ kind: "waiting", tapsNeeded: 2 });
  });

  it("150ms gives a settable 400, 149ms is out of range, 3,000ms gives 20", () => {
    expect(after(every(150, 4))).toEqual({ kind: "reading", bpm: 400 });
    expect(after(every(149, 4))).toEqual({ kind: "out-of-range", bpm: 403 });
    expect(after(every(3000, 3))).toEqual({ kind: "reading", bpm: 20 });
  });

  it("two taps 3,500ms apart say out of range, and the next tap clears it", () => {
    expect(after([1000, 4500])).toEqual({ kind: "out-of-range", bpm: null });
    expect(after([1000, 4500, 5000])).toEqual({ kind: "waiting", tapsNeeded: 1 });
  });

  it("an equal timestamp changes nothing", () => {
    expect(after([1000, 1000])).toEqual({ kind: "waiting", tapsNeeded: 2 });
    expect(after([1000, 1500, 1500, 2000])).toEqual({ kind: "reading", bpm: 120 });
  });

  it("SC-002: eight taps with up to 15ms of error, 2,000 seeds", () => {
    let s = 1;
    const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) * 30 - 15;
    for (let i = 0; i < 2000; i++) {
      const reading = after(every(500, 8).map((t) => t + r()));
      expect(reading.kind).toBe("reading");
      if (reading.kind === "reading") expect(Math.abs(reading.bpm - 120)).toBeLessThanOrEqual(2);
    }
  });
});

const eventRow = (durationHint: unknown) => ({
  id: "018f0000-0000-7000-8000-000000000001",
  bandId: "018f0000-0000-7000-8000-000000000002",
  partId: "018f0000-0000-7000-8000-000000000003",
  rank: "a0",
  kind: "notes",
  frets: { "0": 5 },
  techniques: {},
  repeat: 1,
  durationHint,
  tupletId: null,
  tupletCount: null,
  groupKind: null,
  updatedAt: "2026-11-05T00:00:00.000Z-0000-a",
  deletedAt: null,
  fieldClocks: {},
  serverSeq: 0,
});

describe("INV-043 the six values and the wire, and INV-018 the stored range", () => {
  it("every readable value is one the wire takes, and nothing else is", () => {
    const shape = eventRowSchema.shape.durationHint;
    for (const d of ["w", "h", "q", "8", "16", "32"]) {
      expect(readDuration(d)?.id).toBe(d);
      expect(shape.safeParse(d).success).toBe(true);
    }
    for (const u of ["64", "", "Q", 7, true]) {
      expect(readDuration(u)).toBeNull();
      expect(shape.safeParse(u).success).toBe(false);
    }
    expect(eventRow("q").durationHint).toBe("q");
  });

  it("usableTempo agrees with the wire at every whole number, and at the plan's odd values", () => {
    const shape = songRowSchema.shape.bpm;
    for (let n = -2; n <= 1002; n++) {
      expect(usableTempo(n) !== null, String(n)).toBe(shape.safeParse(n).success);
    }
    for (const odd of [120.5, Number.NaN, "120", undefined]) {
      expect(usableTempo(odd)).toBeNull();
    }
  });

  it("INV-042 every reading the sheet can offer passes the wire", () => {
    const shape = songRowSchema.shape.bpm;
    const offered = new Set<number>();
    for (let ms = 100; ms <= 3000; ms += 0.5) {
      const reading = after(every(ms, 3));
      if (reading.kind === "reading") offered.add(reading.bpm);
    }
    expect(Math.min(...offered)).toBe(20);
    expect(Math.max(...offered)).toBe(400);
    for (const bpm of offered) expect(shape.safeParse(bpm).success, String(bpm)).toBe(true);
  });
});

/** A fake clock and a timer with jitter, in virtual time. */
function rig() {
  let now = 0;
  const scheduled: { time: number; level: ClickLevel; at: number }[] = [];
  let closes = 0;
  const timers = new Map<number, { fn: () => void; at: number }>();
  let id = 0;
  const clock: ClickClock = {
    now: () => now,
    audible: true,
    ready: () => Promise.resolve(true),
    schedule: (time, level) => scheduled.push({ time, level, at: now }),
    close: () => void closes++,
    onLost() {},
  };
  const changes: EngineChange[] = [];
  const engine = createEngine({
    makeClock: () => clock,
    setTimer: (fn, ms) => {
      timers.set(++id, { fn, at: now + ms / 1000 });
      return id;
    },
    clearTimer: (h) => void timers.delete(h as number),
    onChange: (c) => changes.push(c),
  });
  const run = (until: number, jitter = () => 0) => {
    for (;;) {
      let next: [number, { fn: () => void; at: number }] | null = null;
      for (const e of timers) if (!next || e[1].at < next[1].at) next = e;
      if (!next || next[1].at > until) break;
      timers.delete(next[0]);
      now = Math.max(now, next[1].at + jitter());
      next[1].fn();
    }
    now = Math.max(now, until);
  };
  const flush = () => Promise.resolve().then(() => Promise.resolve());
  return {
    engine,
    scheduled,
    changes,
    run,
    flush,
    timers,
    get closes() {
      return closes;
    },
    get now() {
      return now;
    },
    set now(v) {
      now = v;
    },
  };
}

let serial = 0;
const col = (over: Partial<EventRow>) =>
  ({ id: `c${++serial}`, kind: "notes", frets: { "0": 1 }, repeat: 1, durationHint: "q", tupletId: null, tupletCount: null, groupKind: null, ...over }) as EventRow;
const barline = () => col({ kind: "barline", frets: {}, durationHint: null });

/** Ten minutes of bars with a triplet, a quintuplet and a septuplet, at any tempo. */
function longScore() {
  const events: EventRow[] = [];
  for (let b = 0; b < 2000; b++) {
    const t = `t${b}`;
    const f = `f${b}`;
    const s = `s${b}`;
    events.push(
      ...[0, 1, 2].map(() => col({ durationHint: "8", tupletId: t, tupletCount: 3, groupKind: "tuplet" })),
      ...[0, 1, 2, 3, 4].map(() => col({ durationHint: "16", tupletId: f, tupletCount: 5, groupKind: "tuplet" })),
      ...[0, 1, 2, 3, 4, 5, 6].map(() => col({ durationHint: "32", tupletId: s, tupletCount: 7, groupKind: "tuplet" })),
      col({ durationHint: "q" }),
      barline(),
    );
  }
  return readNotation([{ step: {} as never, events }]);
}

describe("INV-021 following a score with tuplets for ten simulated minutes", () => {
  for (const bpm of [40, 120, 240]) {
    it(`every click within 1ms at ${bpm}, jitter to 200ms, no growth`, async () => {
      const score = longScore();
      const r = rig();
      r.engine.start({ bpm, stream: clickStream(score, true) });
      await r.flush();
      let s = bpm;
      const jitter = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296) * 0.2;
      r.run(600, jitter);
      expect(r.engine.state).toBe("running");
      const stream = clickStream(score, true);
      const t0 = r.scheduled[0].time;
      let worst = 0;
      for (const got of r.scheduled) {
        const c: StreamClick = stream.next().value;
        const ideal = t0 + (c.tick / TICKS_PER_BEAT) * (60 / bpm);
        worst = Math.max(worst, Math.abs(got.time - ideal));
        expect(got.level).toBe(c.level);
        expect(got.time).toBeGreaterThanOrEqual(got.at);
      }
      expect(worst).toBeLessThan(0.001);
      expect(r.scheduled.length).toBeGreaterThan(600 * (bpm / 60));
    });
  }
});

describe("INV-022 a 200ms stall in each stage", () => {
  const STAGES: [string, number][] = [
    ["count-in", 0.3],
    ["following", 2.5],
    ["plain", 10],
  ];
  for (const [name, at] of STAGES) {
    it(`moves and drops nothing during ${name}`, async () => {
      const score = longScore();
      const make = async (stall: boolean) => {
        const r = rig();
        const events = clickStream({ ...score, clicks: score.clicks.slice(0, 19), lengthTicks: TICKS_PER_BEAT * 4 }, true);
        r.engine.start({ bpm: 120, stream: events });
        await r.flush();
        r.run(at);
        if (stall) r.now = r.now + 0.2;
        r.run(at + 3);
        return r;
      };
      const calm = await make(false);
      const stalled = await make(true);
      expect(stalled.engine.state).toBe("running");
      const n = Math.min(calm.scheduled.length, stalled.scheduled.length);
      expect(n).toBeGreaterThan(10);
      expect(stalled.scheduled.slice(0, n).map((x) => [x.time, x.level])).toEqual(
        calm.scheduled.slice(0, n).map((x) => [x.time, x.level]),
      );
    });
  }
});

describe("INV-023 INV-026 a dry queue and a stop in each stage", () => {
  it("a stream that ends stops with a reason, closed, nothing left", async () => {
    const r = rig();
    function* short(): Generator<StreamClick> {
      yield { tick: 0, level: "beat", phase: "count-in", count: 1 };
    }
    r.engine.start({ bpm: 120, stream: short() });
    await r.flush();
    r.run(1);
    expect(r.engine.state).toBe("idle");
    expect(r.closes).toBe(1);
    expect(r.changes).toContainEqual({ kind: "stopped", reason: "fell-behind" });
    expect(r.timers.size).toBe(0);
  });

  for (const at of [0, 0.3, 2.5, 10]) {
    it(`stop at ${at}s leaves no timer, and a queue that reports nothing`, async () => {
      const r = rig();
      r.engine.start({ bpm: 120, stream: clickStream(longScore(), true) });
      await r.flush();
      r.run(at);
      const before = r.scheduled.length;
      r.engine.stop("tap");
      expect(r.engine.state).toBe("idle");
      expect(r.closes).toBe(1);
      expect(r.timers.size).toBe(0);
      expect(r.engine.due()).toEqual([]);
      r.run(at + 5);
      expect(r.scheduled.length).toBe(before);
    });
  }
});

describe("INV-025 a tempo moved at each stage", () => {
  const pairs: [number, number][] = [
    [240, 60],
    [60, 240],
    [120, 121],
    [999, 1],
    [1, 999],
  ];
  for (const [from, to] of pairs) {
    for (const at of [0.4, 2.5, 30]) {
      it(`${from} to ${to} at ${at}s: queued clicks stay, later ones follow, order holds`, async () => {
        const r = rig();
        r.engine.start({ bpm: from, stream: clickStream({ clicks: [], lengthTicks: 0, timedFromStart: false }, false) });
        await r.flush();
        r.run(at);
        const queued = r.scheduled.map((x) => x.time);
        r.engine.setTempo(to);
        r.run(at + 5);
        expect(r.engine.state).toBe("running");
        expect(r.scheduled.slice(0, queued.length).map((x) => x.time)).toEqual(queued);
        const times = r.scheduled.map((x) => x.time);
        times.forEach((t, i) => {
          if (i) expect(t).toBeGreaterThan(times[i - 1]);
        });
        const tail = times.slice(queued.length + 1);
        tail.forEach((t, i) => {
          if (i) expect(Math.abs(t - tail[i - 1] - 60 / to)).toBeLessThan(0.001);
        });
      });
    }
  }

  it("10 to 120 with the last click 5.9s old is not falling behind", async () => {
    const r = rig();
    r.engine.start({ bpm: 10, stream: clickStream({ clicks: [], lengthTicks: 0, timedFromStart: false }, false) });
    await r.flush();
    r.run(5.9);
    r.engine.setTempo(120);
    r.run(7);
    expect(r.engine.state).toBe("running");
    expect(r.changes.filter((c) => c.kind === "stopped")).toEqual([]);
  });
});
