/**
 * INV-001 oracle: what the engine hands its clock, and what `due()` shows, for three click streams at three
 * tempos, recorded on the tree before spec 011 touched the engine. Without RECORD_GOLDEN it compares to the JSON.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ClickClock } from "@/lib/rhythm/audio";
import { TICKS_PER_BEAT } from "@/lib/rhythm/durations";
import type { Score, StreamClick } from "@/lib/rhythm/notation";
import { createEngine } from "@/lib/rhythm/scheduler";
import { clickStream } from "@/lib/rhythm/stream";

const GOLDEN = join(__dirname, "engine-golden.json");

const score: Score = {
  clicks: [
    { tick: 0, level: "accent" },
    { tick: TICKS_PER_BEAT / 2, level: "soft" },
    { tick: TICKS_PER_BEAT, level: "beat" },
  ],
  lengthTicks: 2 * TICKS_PER_BEAT,
  timedFromStart: true,
};
const empty: Score = { clicks: [], lengthTicks: 0, timedFromStart: false };

const streams: Record<string, () => Iterator<StreamClick>> = {
  plain: () => clickStream(empty, false),
  following: () => clickStream(score, true),
  followingThenPlain: () => clickStream({ ...score, timedFromStart: false }, true),
};

async function record(bpm: number, make: () => Iterator<StreamClick>) {
  let now = 10;
  const calls: [number, string][] = [];
  const timers = new Map<number, { fn: () => void; at: number }>();
  let id = 0;
  let settle!: (r: boolean) => void;
  const ready = new Promise<boolean>((res) => (settle = res));
  const clock: ClickClock = {
    now: () => now,
    audible: true,
    ready: () => ready,
    schedule: (time, level) => void calls.push([Math.round(time * 1e6) / 1e6, level]),
    close() {},
    onLost() {},
  };
  const engine = createEngine({
    makeClock: () => clock,
    makeSilentClock: () => clock,
    setTimer: (fn, ms) => {
      timers.set(++id, { fn, at: now + ms / 1000 });
      return id;
    },
    clearTimer: (h) => void timers.delete(h as number),
  });
  engine.start({ bpm, stream: make() });
  settle(true);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  const due: unknown[] = [];
  for (let step = 0; step < 400; step++) {
    let next: [number, { fn: () => void; at: number }] | null = null;
    for (const e of timers) if (!next || e[1].at < next[1].at) next = e;
    if (!next) break;
    timers.delete(next[0]);
    now = Math.max(now, next[1].at);
    next[1].fn();
    for (const d of engine.due()) due.push([Math.round(d.time * 1e6) / 1e6, d.tick, d.level, d.phase, d.count]);
    if (now > 10 + 8) break;
  }
  engine.stop("tap");
  return { calls, due };
}

describe("INV-001 the engine's calls are the recorded ones", () => {
  it("matches engine-golden.json", async () => {
    const got: Record<string, unknown> = {};
    for (const [name, make] of Object.entries(streams))
      for (const bpm of [40, 120, 240]) got[`${name}@${bpm}`] = await record(bpm, make);
    if (process.env.RECORD_GOLDEN) {
      writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + "\n");
      return;
    }
    expect(got).toEqual(JSON.parse(readFileSync(GOLDEN, "utf8")));
  });
});
