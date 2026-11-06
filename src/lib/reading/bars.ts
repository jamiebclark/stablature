import type { DrawnPass } from "@/lib/arrangement/passes";
import type { EventRow } from "@/lib/model";
import { beatsPerBar } from "@/lib/rhythm/notation";
import { usableTempo } from "@/lib/rhythm/tempo";
import { countBars, type TabColumn } from "@/lib/tab/layout";

export interface PassBars {
  /** Per pass: the sum of `countBars(events)` over every earlier pass. */
  readonly offset: readonly number[];
  readonly total: number;
}

/** A column's running number is `offset[pass] + column.barNumber`. */
export function passBars(passes: readonly DrawnPass[]): PassBars {
  const offset: number[] = [];
  let total = 0;
  for (const pass of passes) {
    offset.push(total);
    total += countBars(pass.events);
  }
  return { offset, total };
}

/** The first non-barline column of each bar. A bar with no columns gets none. */
export function barStarts(columns: readonly Pick<TabColumn, "kind" | "barNumber">[]): number[] {
  const starts: number[] = [];
  let seen = 0;
  columns.forEach((column, i) => {
    if (column.kind === "barline" || column.barNumber === seen) return;
    seen = column.barNumber;
    starts.push(i);
  });
  return starts;
}

export interface PartHeading {
  readonly tempo: number | null;
  readonly beats: number | null;
  /** `120 bpm · 4 beats a bar`, with whatever is unknown left out; null when both are. */
  readonly text: string | null;
}

export function partHeading(events: readonly EventRow[], bpm: unknown): PartHeading {
  const tempo = usableTempo(bpm);
  const beats = beatsPerBar(events);
  const pieces = [
    tempo === null ? null : `${tempo} bpm`,
    beats === null ? null : `${beats} ${beats === 1 ? "beat" : "beats"} a bar`,
  ].filter((p): p is string => p !== null);
  return { tempo, beats, text: pieces.length ? pieces.join(" · ") : null };
}
