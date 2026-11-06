import type { DrawnPass } from "@/lib/arrangement/passes";
import type { ColumnTick } from "@/lib/rhythm/notation";

/** The same text `TabStaff` puts on a column. `marks.ts` keeps its own copy; a test pins them together. */
export const columnKey = (eventId: string, repetition: number): string => `${eventId}-${repetition}`;

export interface ReadingStop {
  readonly pass: number;
  readonly key: string;
  /** The running bar number. */
  readonly bar: number;
}

/** The last column at or before the tick, or null below 0, past `lengthTicks`, or on an empty list. */
export function columnAt(columns: readonly ColumnTick[], tick: number, lengthTicks = Infinity): ColumnTick | null {
  if (columns.length === 0 || tick < 0 || tick >= lengthTicks) return null;
  let lo = 0;
  let hi = columns.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (columns[mid].tick <= tick) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found < 0 ? null : columns[found];
}

/** Every column that can hold the reading position, timed or not. Barlines are not stops. */
export function readingStops(passes: readonly DrawnPass[], offsets: readonly number[]): ReadingStop[] {
  const stops: ReadingStop[] = [];
  passes.forEach((pass, p) => {
    let bar = 1;
    for (const e of pass.events) {
      if (e.kind === "barline") {
        bar += 1;
        continue;
      }
      for (let r = 0; r < Math.max(1, e.repeat); r++) {
        stops.push({ pass: p, key: columnKey(e.id, r), bar: (offsets[p] ?? 0) + bar });
      }
    }
  });
  return stops;
}

const indexOf = (stops: readonly ReadingStop[], at: ReadingStop) =>
  stops.findIndex((s) => s.pass === at.pass && s.key === at.key);

export function stepColumn(stops: readonly ReadingStop[], at: ReadingStop | null, by: -1 | 1): ReadingStop | null {
  if (stops.length === 0) return null;
  if (!at) return by === 1 ? stops[0] : null;
  const i = indexOf(stops, at);
  if (i < 0) return by === 1 ? stops[0] : null;
  return stops[Math.min(stops.length - 1, Math.max(0, i + by))];
}

/** Back goes to the current bar's start unless already there, then the previous bar's. Stops at the ends. */
export function stepBar(stops: readonly ReadingStop[], at: ReadingStop | null, by: -1 | 1): ReadingStop | null {
  if (stops.length === 0) return null;
  if (!at) return by === 1 ? stops[0] : null;
  const i = indexOf(stops, at);
  if (i < 0) return by === 1 ? stops[0] : null;
  const firstOf = (from: number) => {
    let j = from;
    while (j > 0 && stops[j - 1].bar === stops[from].bar && stops[j - 1].pass === stops[from].pass) j--;
    return j;
  };
  if (by === 1) {
    for (let j = i + 1; j < stops.length; j++) if (stops[j].bar !== at.bar) return stops[j];
    return stops[i];
  }
  const start = firstOf(i);
  if (start < i) return stops[start];
  return start === 0 ? stops[0] : stops[firstOf(start - 1)];
}

export const FOLLOW_REST_MS = 4000;

/** Following resumes once the reader has left the page alone for `FOLLOW_REST_MS`. */
export function mayFollow(lastReaderScroll: number | null, now: number): boolean {
  return lastReaderScroll === null || now - lastReaderScroll >= FOLLOW_REST_MS;
}
