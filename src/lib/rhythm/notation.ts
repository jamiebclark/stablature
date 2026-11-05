import type { DrawnPass } from "@/lib/arrangement/passes";
import { groupNumber, type EventRow } from "@/lib/model";
import { readDuration, TICKS_PER_BEAT } from "./durations";

/** Types for reading a pass as timed notation. `readNotation` follows. */

export type ClickLevel = "accent" | "beat" | "soft";

export interface ScoreClick {
  /** From the first moment of the first bar. */
  readonly tick: number;
  readonly level: ClickLevel;
}

export interface Score {
  readonly clicks: readonly ScoreClick[];
  /** Where the last timed bar ended. The plain beat carries on from here. */
  readonly lengthTicks: number;
  /** True when the first bar with any length is timed. */
  readonly timedFromStart: boolean;
}

export type ClickPhase = "count-in" | "following" | "plain";

export interface StreamClick {
  readonly tick: number;
  readonly level: ClickLevel;
  readonly phase: ClickPhase;
  /** 1 to 4 during the count-in, otherwise null. */
  readonly count: number | null;
}

export const EMPTY_SCORE: Score = { clicks: [], lengthTicks: 0, timedFromStart: false };

const playable = (e: EventRow) => e.kind === "notes" || e.kind === "rest";

/** How many of a counted group's `n` columns fit the beats it takes, or null for a size with no fraction. */
function fitFor(n: number): number | null {
  // The largest power of two not above n: 3 fits 2, 5 to 7 fit the next power down, 9 to 15 fit 8.
  if (!Number.isInteger(n) || n < 2 || n > 16) return null;
  return 2 ** Math.floor(Math.log2(n));
}

interface Group {
  /** Null for a plain group. */
  readonly counted: { readonly n: number; readonly fit: number } | null;
}

/** Per pass and per group id, over playable rows only: the group as it reads, or null when it fails. */
function census(events: readonly EventRow[]): Map<string, Group | null> {
  const seen = new Map<string, { columns: number; repeated: boolean; numbers: Set<number | null> }>();
  for (const e of events) {
    if (!playable(e) || !e.tupletId) continue;
    const entry = seen.get(e.tupletId) ?? { columns: 0, repeated: false, numbers: new Set() };
    entry.columns += 1;
    if (e.repeat > 1) entry.repeated = true;
    entry.numbers.add(groupNumber(e));
    seen.set(e.tupletId, entry);
  }
  const out = new Map<string, Group | null>();
  for (const [id, { columns, repeated, numbers }] of seen) {
    if (numbers.size !== 1) {
      out.set(id, null);
      continue;
    }
    const [n] = [...numbers];
    if (n === null) {
      out.set(id, { counted: null });
      continue;
    }
    const fit = fitFor(n);
    out.set(id, n === columns && !repeated && fit !== null ? { counted: { n, fit } } : null);
  }
  return out;
}

const RANK = { soft: 1, beat: 2, accent: 3 } as const;

/** One bar's clicks and length, or null when the bar is not timed. */
function readBar(
  bar: readonly EventRow[],
  groups: Map<string, Group | null>,
  startedPlain: Set<string>,
): { clicks: ScoreClick[]; length: number } | null {
  const levels = new Map<number, ClickLevel>();
  const put = (tick: number, level: ClickLevel) => {
    const had = levels.get(tick);
    if (!had || RANK[level] > RANK[had]) levels.set(tick, level);
  };
  let at = 0;
  for (const e of bar) {
    const duration = readDuration(e.durationHint);
    if (!duration) return null;
    let hitTicks = duration.ticks;
    let counted = false;
    let firstOfPlain = false;
    if (e.tupletId) {
      const group = groups.get(e.tupletId);
      if (!group) return null;
      if (group.counted) {
        hitTicks = (duration.ticks * group.counted.fit) / group.counted.n;
        counted = true;
      } else if (!startedPlain.has(e.tupletId)) {
        startedPlain.add(e.tupletId);
        firstOfPlain = true;
      }
    }
    const hits = Math.max(1, e.repeat);
    for (let h = 0; h < hits; h++) {
      if (counted || (firstOfPlain && h === 0)) put(at, "soft");
      at += hitTicks;
    }
  }
  put(0, "accent");
  for (let t = TICKS_PER_BEAT; t < at; t += TICKS_PER_BEAT) put(t, "beat");
  const clicks = [...levels]
    .filter(([tick]) => tick < at)
    .sort((a, b) => a[0] - b[0])
    .map(([tick, level]) => ({ tick, level }));
  return { clicks, length: at };
}

/** Reads the passes as timed notation, ending at the first bar that cannot be timed. */
export function readNotation(passes: readonly DrawnPass[]): Score {
  const clicks: ScoreClick[] = [];
  let offset = 0;
  let timed = false;
  for (const pass of passes) {
    const groups = census(pass.events);
    const startedPlain = new Set<string>();
    const bars: EventRow[][] = [[]];
    for (const e of pass.events) {
      if (e.kind === "barline") bars.push([]);
      else if (playable(e)) bars[bars.length - 1].push(e);
    }
    for (const bar of bars) {
      if (bar.length === 0) continue;
      const read = readBar(bar, groups, startedPlain);
      if (!read) return { clicks, lengthTicks: offset, timedFromStart: timed };
      for (const c of read.clicks) clicks.push({ tick: offset + c.tick, level: c.level });
      offset += read.length;
      timed = true;
    }
  }
  return { clicks, lengthTicks: offset, timedFromStart: timed };
}
