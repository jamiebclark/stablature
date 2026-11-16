import { describe, expect, it } from "vitest";
import type { DrawnPass } from "@/lib/arrangement/passes";
import type { EventRow } from "@/lib/model";
import { TICKS_PER_BEAT as Q } from "@/lib/rhythm/durations";
import { EMPTY_SCORE, notationColumns, readNotation, type StreamClick } from "@/lib/rhythm/notation";
import type { StreamItem } from "@/lib/rhythm/scheduler";
import { clickStream } from "@/lib/rhythm/stream";
import { bar, ev, group, pass, quarters } from "@/lib/rhythm/__tests__/notation-helpers";
import { presetById } from "@/lib/tunings";
import { audibleFor, playRounds, playStream, roundClicks } from "../stream";
import { playTimeline } from "../timeline";
import { LEN, passesOf } from "./fixtures";

const bass = presetById("bass4-e")!;
const l = (id: string) => LEN.find((r) => r.id === id)!;
const kinds = (items: StreamItem[], kind: "click" | "mark" | "note" | "end") =>
  items.filter((i) => ("kind" in i ? i.kind : "click") === kind);

function drain(passes: DrawnPass[], loops: number, follow = false, score = EMPTY_SCORE) {
  let reads = 0;
  const items: StreamItem[] = [];
  for (const item of playStream(playRounds(passes, bass), score, follow, { loop: () => ++reads <= loops })) items.push(item);
  return items;
}

describe("INV-004 / INV-008 the play stream", () => {
  it("S1: L2 once: count-in, eight marks and notes, the end at 12 beats", () => {
    const items = drain(passesOf(l("L2").passes), 0);
    expect(kinds(items, "click").slice(0, 4).map((c) => [c.tick, (c as StreamClick).phase])).toEqual(
      [0, 1, 2, 3].map((k) => [k * Q, "count-in"]),
    );
    expect(kinds(items, "mark").map((m) => m.tick)).toEqual(Array.from({ length: 8 }, (_, k) => (4 + k) * Q));
    expect(kinds(items, "note").map((m) => m.tick)).toEqual(Array.from({ length: 8 }, (_, k) => (4 + k) * Q));
    expect(kinds(items, "end").map((m) => m.tick)).toEqual([12 * Q]);
    expect(items[items.length - 1].tick).toBe(12 * Q);
  });

  it("S2: three rounds, no count-in after the first, no gap", () => {
    const items = drain(passesOf(l("L2").passes), 2);
    const marks = kinds(items, "mark").map((m) => m.tick);
    expect(marks).toHaveLength(24);
    for (const r of [0, 1, 2]) expect(marks[r * 8]).toBe(4 * Q + 8 * r * Q);
    expect(kinds(items, "click").filter((c) => (c as StreamClick).phase === "count-in")).toHaveLength(4);
    expect(kinds(items, "end")[0].tick).toBe(4 * Q + 24 * Q);
    const ticks = items.map((i) => i.tick);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
  });

  it("S3: a timed score follows; the round's clicks are clickStream's own, rebased and cut", () => {
    const passes = passesOf(l("L3").passes);
    const score = readNotation(passes);
    const got = roundClicks(score, true, l("L3").total);
    expect(got.map((c) => [c.tick / Q, c.level])).toEqual([[0, "accent"], [1, "beat"], [2, "beat"], [3, "accent"], [4, "beat"]]);
    const own = [...take(clickStream(score, true), 4 + 5)].slice(4).map((c) => ({ ...c, tick: c.tick - 4 * Q }));
    expect(got).toEqual(own);
    const items = drain(passes, 0, true, score);
    expect(kinds(items, "click").slice(4).map((c) => c.tick)).toEqual(got.map((c) => c.tick + 4 * Q));
  });

  it("S6: Click off silences every click but the count-in", () => {
    const audible = audibleFor({ click: () => false });
    const items = kinds(drain(passesOf(l("L2").passes), 0), "click") as StreamClick[];
    expect(items.filter(audible).map((c) => c.phase)).toEqual(["count-in", "count-in", "count-in", "count-in"]);
    expect(items.filter(audibleFor({ click: () => true }))).toHaveLength(items.length);
  });
});

function take<T>(it: Iterator<T> | Iterable<T>, n: number): T[] {
  const out: T[] = [];
  const iter = Symbol.iterator in it ? (it as Iterable<T>)[Symbol.iterator]() : (it as Iterator<T>);
  while (out.length < n) {
    const s = iter.next();
    if (s.done) break;
    out.push(s.value);
  }
  return out;
}

// S4: the rhythm corpus, rebuilt as positions-vs-click.test.ts builds it.
const bars = (k: number, perBar = 4) =>
  Array.from({ length: k }, () => [...Array.from({ length: perBar }, () => ev({})), bar()]).flat();
const BARS: Record<string, () => EventRow[]> = {
  "no barlines": () => quarters(8),
  "trailing barline": () => [...quarters(4), bar()],
  "leading barline": () => [bar(), ...quarters(4)],
  "empty bar in the middle": () => [...quarters(4), bar(), bar(), ...quarters(4)],
  "sixteen bars": () => bars(16),
  "one bar wider than a line": () => quarters(40),
  "a repeat crossing a line": () => [...quarters(3), ev({ repeat: 6, durationHint: "8" }), bar(), ...quarters(4)],
  "no notes": () => [bar()],
  empty: () => [],
  "a triplet": () => [...group("t1", 3, "8"), ev({}), bar(), ...quarters(4)],
  untimed: () => [ev({ durationHint: null }), ev({ durationHint: null }), bar(), ...quarters(2)],
};
const ARR: Record<string, (events: EventRow[]) => DrawnPass[]> = {
  "one part": (e) => [pass(e)],
  "A x4": (e) => [pass(e), pass(e), pass(e), pass(e)],
  "last pass a variant": (e) => [pass(e), pass(e.slice(0, Math.ceil(e.length / 2)))],
  "a sliced pass": (e) => [pass(e.slice(1, Math.max(2, e.length - 1)))],
  "a pass with nothing": (e) => [pass(e), pass([]), pass(e)],
};

describe("S4: every timed column has the click's tick", () => {
  for (const [bn, mk] of Object.entries(BARS)) {
    for (const [an, arr] of Object.entries(ARR)) {
      it(`${bn} × ${an}`, () => {
        const passes = arr(mk());
        const hits = new Map(playTimeline(passes, bass).hits.map((h) => [`${h.pass}:${h.eventId}:${h.repetition}`, h.tick]));
        for (const c of notationColumns(passes)) {
          expect(hits.get(`${c.pass}:${c.eventId}:${c.repetition}`), `${c.eventId}`).toBe(c.tick);
        }
      });
    }
  }
});
