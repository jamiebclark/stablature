/**
 * INV-003 over the 6000 seeded arrangements of notation-oracle section G (sections, repeats, variants, bar ranges,
 * counted and plain groups, groups that do not read, spaces, repeats, unset and unknown lengths).
 *
 * The reference is written from spec 011 "When a note has no length" and spec 005's tables in exact fractions. It
 * expands the arrangement and slices bars itself (copied from notation-oracle's reference, which shares no code with
 * expand.ts or eventsInBars), reads groups itself, and never calls `playTimeline`, `readGroups` or `hitTicks`.
 * Compared: every hit's (eventId, repetition, start tick, length in ticks), in order, and the round's length.
 */
import { describe, expect, it } from "vitest";
import { expandArrangement, parseArrangement } from "@/lib/arrangement/expand";
import { drawnPasses } from "@/lib/arrangement/passes";
import type { ArrangementEntryRow, EventRow } from "@/lib/model";
import { playTimeline } from "@/lib/playback/timeline";
import { presetById } from "@/lib/tunings";
import { buildSong } from "./seeded-songs";

class Q {
  constructor(readonly n: bigint, readonly d: bigint = BigInt(1)) {}
  add(o: Q) {
    return new Q(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  mul(o: Q) {
    return new Q(this.n * o.n, this.d * o.d);
  }
  ticks() {
    const t = this.n * BigInt(360360);
    if (t % this.d !== BigInt(0)) throw new Error("not a whole tick");
    return Number(t / this.d);
  }
}
const q = (n: number, d = 1) => new Q(BigInt(n), BigInt(d));
const LENGTH: Record<string, Q> = { w: q(4), h: q(2), q: q(1), "8": q(1, 2), "16": q(1, 4), "32": q(1, 8) };
const FRACTION: Record<number, Q> = {
  2: q(1), 4: q(1), 8: q(1), 16: q(1), 3: q(2, 3), 5: q(4, 5), 6: q(4, 6), 7: q(4, 7),
  9: q(8, 9), 10: q(8, 10), 11: q(8, 11), 12: q(8, 12), 13: q(8, 13), 14: q(8, 14), 15: q(8, 15),
};

/** Flat entries to passes: a section repeats its children, a variant takes the last pass (notation-oracle's reference). */
function passesOf(entries: readonly ArrangementEntryRow[]) {
  type Node = { entry: ArrangementEntryRow; children?: Node[] };
  const root: Node[] = [];
  const open: Node[][] = [root];
  for (const entry of entries) {
    if (entry.kind === "section_end") {
      if (open.length > 1) open.pop();
    } else if (entry.kind === "section_start") {
      const node: Node = { entry, children: [] };
      open[open.length - 1].push(node);
      open.push(node.children!);
    } else if (entry.kind === "part") {
      if (entry.partId) open[open.length - 1].push({ entry });
    }
  }
  const out: { part: string; from: number | null; to: number | null }[] = [];
  const walk = (nodes: Node[]) => {
    for (const { entry, children } of nodes) {
      const times = Math.max(1, entry.repeat);
      for (let i = 1; i <= times; i++) {
        if (children) walk(children);
        else {
          const last = i === times && entry.lastRepeatPartId;
          out.push({ part: (last || entry.partId) as string, from: entry.fromBar, to: entry.toBar });
        }
      }
    }
  };
  walk(root);
  return out;
}

function barsOf(events: readonly EventRow[]) {
  const bars: EventRow[][] = [[]];
  for (const e of events) {
    if (e.kind === "barline") bars.push([]);
    else bars[bars.length - 1].push(e);
  }
  return bars;
}

/** The spec's rule, hit by hit. */
function reference(entries: readonly ArrangementEntryRow[], byPart: Record<string, EventRow[]>) {
  const hits: [string, number, number, number][] = [];
  let at = q(0);
  for (const pass of passesOf(entries)) {
    const all = barsOf(byPart[pass.part] ?? []);
    const from = pass.from ?? 1;
    const to = pass.to ?? all.length;
    const inPass = all.filter((_, i) => i + 1 >= from && i + 1 <= to).flat();
    let carried: Q | null = null; // rule 4: resets every pass
    for (const c of inPass) {
      const set = typeof c.durationHint === "string" && c.durationHint in LENGTH ? LENGTH[c.durationHint] : null;
      if (set) carried = set; // rule 2 counts every playable column, notes and spaces alike
      let len = set ?? carried ?? q(1); // rules 1, 2, 3
      if (c.tupletId) {
        const mates = inPass.filter((m) => m.tupletId === c.tupletId);
        const plain = (m: EventRow) => m.groupKind === "plain" && m.tupletCount === null;
        if (!mates.every(plain) && !mates.some(plain)) {
          const numbers = new Set(mates.map((m) => m.tupletCount ?? 3));
          const [n] = numbers;
          const reads = numbers.size === 1 && n === mates.length && !mates.some((m) => m.repeat > 1) && !!FRACTION[n];
          if (reads) len = len.mul(FRACTION[n]); // rule 5
        }
      }
      for (let r = 0; r < Math.max(1, c.repeat); r++) {
        hits.push([c.id, r, at.ticks(), len.ticks()]);
        at = at.add(len);
      }
    }
  }
  return { hits, length: at.ticks() };
}

const bass = presetById("bass4-e")!;

describe("INV-003 the length rule over notation-oracle G's 6000 seeded arrangements", () => {
  it("every hit starts and lasts what the rule gives", () => {
    let unset = 0;
    let groups = 0;
    for (let seed = 1; seed <= 6000; seed++) {
      const { entries, byPart } = buildSong(seed);
      const passes = drawnPasses(expandArrangement(parseArrangement(entries)), byPart);
      const got = playTimeline(passes, bass);
      const want = reference(entries, byPart);
      const at = `seed ${seed}`;
      expect(got.hits.map((h) => [h.eventId, h.repetition, h.tick, h.ticks]), at).toEqual(want.hits);
      expect(got.lengthTicks, at).toBe(want.length);
      if (got.rule === "some" || got.rule === "none") unset++;
      if (passes.some((p) => p.events.some((e) => e.tupletId))) groups++;
    }
    // The walk must have met the cases it exists for.
    expect(unset).toBeGreaterThan(500);
    expect(groups).toBeGreaterThan(1000);
  });
});
