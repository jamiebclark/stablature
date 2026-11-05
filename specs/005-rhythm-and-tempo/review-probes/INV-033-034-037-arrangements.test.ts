/**
 * INV-033, INV-034, INV-035, INV-037 over G as the plan defines it: seeded ARRANGEMENTS of sections,
 * repeats, variants, bar ranges, groups, spaces and gaps. `notation-oracle.test.ts` generates passes
 * directly, so nothing there goes through the expansion or the bar slicing.
 *
 * The reference is written from the spec's own words with exact fractions. It shares no code with
 * `notation.ts`, `expand.ts`, `eventsInBars` or `groupNumber`, and its filter is not the rule's test.
 */
import { describe, expect, it } from "vitest";
import { expandArrangement, parseArrangement } from "@/lib/arrangement/expand";
import { drawnPasses } from "@/lib/arrangement/passes";
import type { ArrangementEntryRow, EventRow } from "@/lib/model";
import { readNotation } from "@/lib/rhythm/notation";
import { clickStream } from "@/lib/rhythm/stream";

class Q {
  constructor(
    readonly n: bigint,
    readonly d: bigint = BigInt(1),
  ) {}
  add(o: Q) {
    return new Q(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  mul(o: Q) {
    return new Q(this.n * o.n, this.d * o.d);
  }
  cmp(o: Q) {
    const a = this.n * o.d;
    const b = o.n * this.d;
    return a < b ? -1 : a > b ? 1 : 0;
  }
  /** As ticks, at 360360 a beat. Throws rather than rounding. */
  ticks() {
    const t = this.n * BigInt(360360);
    if (t % this.d !== BigInt(0)) throw new Error("not a whole tick");
    return Number(t / this.d);
  }
  isWhole() {
    return this.n % this.d === BigInt(0);
  }
}
const q = (n: number, d = 1) => new Q(BigInt(n), BigInt(d));

/** The spec's table of six. */
const LENGTH: Record<string, Q> = {
  w: q(4),
  h: q(2),
  q: q(1),
  "8": q(1, 2),
  "16": q(1, 4),
  "32": q(1, 8),
};

/** The spec's table of fractions, spelled out. */
const FRACTION: Record<number, Q> = {
  2: q(1),
  4: q(1),
  8: q(1),
  16: q(1),
  3: q(2, 3),
  5: q(4, 5),
  6: q(4, 6),
  7: q(4, 7),
  9: q(8, 9),
  10: q(8, 10),
  11: q(8, 11),
  12: q(8, 12),
  13: q(8, 13),
  14: q(8, 14),
  15: q(8, 15),
};

interface Want {
  at: Q;
  level: string;
}

/** Flat entries to passes, by the spec: a section repeats its children, a variant takes the last pass. */
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

/** The bars of a part, numbered from one, as lists of columns. A barline ends a bar, empty or not. */
function barsOf(events: readonly EventRow[]) {
  const bars: EventRow[][] = [[]];
  for (const e of events) {
    if (e.kind === "barline") bars.push([]);
    else bars[bars.length - 1].push(e);
  }
  return bars;
}

function walk(entries: readonly ArrangementEntryRow[], byPart: Record<string, EventRow[]>) {
  const clicks: Want[] = [];
  let base = q(0);
  let any = false;
  for (const pass of passesOf(entries)) {
    const all = barsOf(byPart[pass.part] ?? []);
    const from = pass.from ?? 1;
    const to = pass.to ?? all.length;
    const bars = all.filter((_, i) => i + 1 >= from && i + 1 <= to);
    const inPass = bars.flat();
    const started = new Set<string>();

    for (const bar of bars) {
      if (bar.length === 0) continue;

      // Is this bar's length known for certain?
      let known = true;
      for (const c of bar) {
        if (typeof c.durationHint !== "string" || !(c.durationHint in LENGTH)) known = false;
        if (!c.tupletId) continue;
        const mates = inPass.filter((m) => m.tupletId === c.tupletId);
        const plain = (m: EventRow) => m.groupKind === "plain" && m.tupletCount === null;
        if (mates.every(plain)) continue;
        if (mates.some(plain)) known = false;
        else {
          const numbers = new Set(mates.map((m) => m.tupletCount ?? 3));
          const [n] = numbers;
          if (numbers.size > 1 || n !== mates.length || mates.some((m) => m.repeat > 1) || !FRACTION[n]) known = false;
        }
      }
      if (!known) return { clicks, length: base, any };

      const levels: Want[] = [];
      const put = (at: Q, level: string) => {
        const rank = ["soft", "beat", "accent"];
        const had = levels.find((l) => l.at.cmp(at) === 0);
        if (!had) levels.push({ at, level });
        else if (rank.indexOf(level) > rank.indexOf(had.level)) had.level = level;
      };
      let at = q(0);
      for (const c of bar) {
        const mates = c.tupletId ? inPass.filter((m) => m.tupletId === c.tupletId) : [];
        const isPlain = mates.length > 0 && mates.every((m) => m.groupKind === "plain" && m.tupletCount === null);
        const counted = mates.length > 0 && !isPlain;
        const hit = counted
          ? LENGTH[c.durationHint as string].mul(FRACTION[c.tupletCount ?? 3])
          : LENGTH[c.durationHint as string];
        const hits = Math.max(1, c.repeat);
        for (let i = 0; i < hits; i++) {
          if (counted) put(at, "soft");
          else if (isPlain && !started.has(c.tupletId!)) {
            started.add(c.tupletId!);
            put(at, "soft");
          }
          at = at.add(hit);
        }
      }
      put(q(0), "accent");
      for (let b = q(1); b.cmp(at) < 0; b = b.add(q(1))) put(b, "beat");
      levels.sort((a, b) => a.at.cmp(b.at));
      for (const l of levels) clicks.push({ at: base.add(l.at), level: l.level });
      base = base.add(at);
      any = true;
    }
  }
  return { clicks, length: base, any };
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return (s >>> 8) / 16777216;
  };
}

let serial = 0;
function row(over: Partial<EventRow>): EventRow {
  serial += 1;
  return {
    id: `e${serial}`,
    bandId: "b",
    partId: "p",
    rank: String(serial).padStart(8, "0"),
    kind: "notes",
    frets: { "0": 5 },
    techniques: {},
    repeat: 1,
    durationHint: "q",
    tupletId: null,
    tupletCount: null,
    groupKind: null,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
    ...over,
  } as EventRow;
}

function entry(over: Partial<ArrangementEntryRow>): ArrangementEntryRow {
  serial += 1;
  return {
    id: `a${serial}`,
    bandId: "b",
    songId: "s",
    rank: String(serial).padStart(8, "0"),
    kind: "part",
    partId: null,
    repeat: 1,
    fromBar: null,
    toBar: null,
    lastRepeatPartId: null,
    label: null,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
    ...over,
  } as ArrangementEntryRow;
}

const D = ["w", "h", "q", "8", "16", "32"];
const UNKNOWN: unknown[] = ["64", "", "Q", 7, true];

function buildPart(r: () => number, id: string, gaps: number): EventRow[] {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const out: EventRow[] = [];
  const duration = () => (r() < gaps ? (r() < 0.5 ? null : pick(UNKNOWN)) : pick(D)) as EventRow["durationHint"];
  const pieces = Math.floor(r() * 9);
  for (let i = 0; i < pieces; i++) {
    const roll = r();
    if (roll < 0.28) out.push(row({ partId: id, kind: "barline", frets: {}, durationHint: null }));
    else if (roll < 0.62) {
      out.push(
        row({
          partId: id,
          kind: r() < 0.25 ? "rest" : "notes",
          frets: r() < 0.2 ? {} : { "0": 5 },
          durationHint: duration(),
          repeat: r() < 0.2 ? 1 + Math.floor(r() * 8) : 1,
        }),
      );
    } else {
      const counted = r() < 0.7;
      const n = pick([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 1]);
      const size = r() < 0.85 ? n : Math.max(1, n + (r() < 0.5 ? -1 : 1));
      const gid = `${id}-g${i}`;
      const d = pick(D) as EventRow["durationHint"];
      for (let k = 0; k < Math.min(size, 16); k++) {
        const legacy = r() < 0.08;
        out.push(
          row({
            partId: id,
            durationHint: r() < gaps / 3 ? null : d,
            tupletId: gid,
            tupletCount: counted ? (legacy && n === 3 ? null : r() < 0.03 ? n + 1 : n) : null,
            groupKind: counted ? (legacy ? null : "tuplet") : r() < 0.03 ? null : "plain",
            repeat: r() < 0.05 ? 2 : 1,
            kind: r() < 0.15 ? "rest" : "notes",
          }),
        );
        if (r() < 0.12) out.push(row({ partId: id, kind: "barline", frets: {}, durationHint: null }));
      }
    }
  }
  return out;
}

function buildSong(seed: number) {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const gaps = pick([0, 0, 0.02, 0.1]);
  const ids = ["A", "B", "C"];
  const byPart: Record<string, EventRow[]> = {};
  for (const id of ids) byPart[id] = buildPart(r, id, gaps);
  const entries: ArrangementEntryRow[] = [];
  let open = 0;
  const count = 1 + Math.floor(r() * 7);
  for (let i = 0; i < count; i++) {
    const roll = r();
    if (roll < 0.14) {
      entries.push(entry({ kind: "section_start", repeat: 1 + Math.floor(r() * 3) }));
      open++;
    } else if (roll < 0.26) {
      entries.push(entry({ kind: "section_end" }));
      open = Math.max(0, open - 1);
    } else if (roll < 0.33) {
      entries.push(entry({ kind: "text", label: "x" }));
    } else {
      const ranged = r() < 0.35;
      const from = ranged && r() < 0.8 ? 1 + Math.floor(r() * 3) : null;
      const to = ranged && r() < 0.8 ? (from ?? 1) + Math.floor(r() * 3) : null;
      entries.push(
        entry({
          kind: "part",
          partId: pick(ids),
          repeat: 1 + Math.floor(r() * 3),
          fromBar: from,
          toBar: to,
          lastRepeatPartId: r() < 0.3 ? pick(ids) : null,
        }),
      );
    }
  }
  return { entries, byPart };
}

describe("G: seeded arrangements against a reference from the spec", () => {
  it("agrees on every click, level and length, and ends where it should", () => {
    const seen = { timed: 0, ended: 0, soft: 0, ranged: 0 };
    for (let seed = 1; seed <= 6000; seed++) {
      const { entries, byPart } = buildSong(seed);
      const steps = expandArrangement(parseArrangement(entries));
      const got = readNotation(drawnPasses(steps, byPart));
      const want = walk(entries, byPart);
      const at = `seed ${seed}`;
      expect(got.clicks.map((c) => [c.tick, c.level]), at).toEqual(
        want.clicks.map((c) => [c.at.ticks(), c.level]),
      );
      expect(got.lengthTicks, at).toBe(want.length.ticks());
      expect(got.timedFromStart, at).toBe(want.any);
      if (want.any) seen.timed++;
      if (want.clicks.some((c) => c.level === "soft")) seen.soft++;
      if (entries.some((e) => e.fromBar !== null || e.toBar !== null)) seen.ranged++;
      // Positions strictly increase, and every click falls inside the score.
      got.clicks.forEach((c, i) => {
        if (i) expect(c.tick, at).toBeGreaterThan(got.clicks[i - 1].tick);
        expect(c.tick, at).toBeLessThan(got.lengthTicks);
      });
      // The stream: plain begins exactly where the score ends.
      const stream = clickStream(got, true);
      let plain = null;
      for (let i = 0; i < got.clicks.length + 8; i++) {
        const c = stream.next().value!;
        if (c.phase === "plain") {
          plain = c;
          break;
        }
      }
      expect(plain?.tick, at).toBe(got.lengthTicks + 4 * 360360);
    }
    expect(seen.timed).toBeGreaterThan(1500);
    expect(seen.soft).toBeGreaterThan(300);
    expect(seen.ranged).toBeGreaterThan(1000);
  });
});

describe("INV-037 a bar's sound depends on that bar alone", () => {
  it("shuffled bars of every length keep their own clicks", () => {
    const r = rng(7);
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
    const barOf = () =>
      Array.from({ length: 1 + Math.floor(r() * 8) }, () => row({ durationHint: pick(D) as EventRow["durationHint"] }));
    for (let round = 0; round < 300; round++) {
      const bars = Array.from({ length: 2 + Math.floor(r() * 5) }, barOf);
      const clicksOf = (order: EventRow[][]) => {
        const events = order.flatMap((b, i) =>
          i ? [row({ kind: "barline", frets: {}, durationHint: null }), ...b] : b,
        );
        const score = readNotation([{ step: {} as never, events }]);
        const lengths = order.map((b) =>
          b.reduce((s, e) => s + LENGTH[e.durationHint as string].ticks(), 0),
        );
        let at = 0;
        return order.map((b, i) => {
          const end = at + lengths[i];
          const own = score.clicks.filter((c) => c.tick >= at && c.tick < end).map((c) => [c.tick - at, c.level]);
          at = end;
          return [b[0].id, JSON.stringify(own)];
        });
      };
      const forward = new Map(clicksOf(bars) as [string, string][]);
      const backward = new Map(clicksOf([...bars].reverse()) as [string, string][]);
      expect(backward).toEqual(forward);
    }
  });
});
