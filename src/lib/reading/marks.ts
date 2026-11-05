/**
 * What a staff shows of a comparison: marks on drawn columns, gaps where the parent had more, and the
 * summary line. All three come from one op list, so they cannot disagree.
 */

import type { EventRow } from "../model";
import type { Density } from "../tab/layout";
import { columnKey } from "./played";
import type { VariantComparison } from "./compare";

export interface DrawnSlice {
  /** Exactly what the staff is given. */
  events: readonly EventRow[];
  fromBar: number | null;
  toBar: number | null;
  density: Density;
}

export interface ColumnMark {
  status: "changed" | "added";
  words: string;
  /** In compact, how many of the `total` repetitions were marked. */
  count: number;
  total: number;
}

export interface StaffMarks {
  columns: Map<string, ColumnMark>;
  removals: Map<string, number>;
  removedAtEnd: number;
  line: string;
  any: boolean;
  /** The parent label, for the words a screen reader hears. */
  parentLabel: string;
}

function barWords(bars: number[]): string {
  const sorted = [...new Set(bars)].sort((x, y) => x - y);
  const items: string[] = [];
  let single = true;
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j += 1;
    if (j - i >= 2) {
      items.push(`${sorted[i]}–${sorted[j]}`);
      single = false;
      i = j + 1;
    } else {
      items.push(String(sorted[i]));
      i += 1;
    }
  }
  const list =
    items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  return `${items.length === 1 && single ? "bar" : "bars"} ${list}`;
}

const baseOf = (key: string) => key.replace(/-\d+$/, "");

export function staffMarks(comparison: VariantComparison, drawn: DrawnSlice): StaffMarks {
  const compact = drawn.density === "compact";
  const sliced = drawn.fromBar !== null || drawn.toBar !== null;
  const first = drawn.fromBar ?? 1;
  const last = drawn.toBar ?? Number.POSITIVE_INFINITY;
  const label = comparison.parent.label;

  const repeats = new Map<string, number>();
  const keys = new Set<string>();
  for (const event of drawn.events) {
    const repeat = event.kind === "barline" ? 1 : Math.max(1, event.repeat);
    repeats.set(event.id, repeat);
    if (compact) keys.add(columnKey(event.id, 0));
    else for (let r = 0; r < repeat; r += 1) keys.add(columnKey(event.id, r));
  }
  const slot = (key: string) => (compact ? columnKey(baseOf(key), 0) : key);

  let changed = 0;
  let added = 0;
  let removed = 0;
  const bars: number[] = [];
  const folded = new Map<string, { changed: number; added: number; words: string }>();
  const removals = new Map<string, number>();
  let removedAtEnd = 0;

  for (const op of comparison.ops) {
    if (op.kind === "same") continue;
    if (op.kind === "removed") {
      if (op.bar < first || op.bar > last) continue;
      removed += 1;
      bars.push(op.bar);
      if (op.before !== null && keys.has(slot(op.before))) {
        const at = slot(op.before);
        removals.set(at, (removals.get(at) ?? 0) + 1);
      } else removedAtEnd += 1;
      continue;
    }
    if (!repeats.has(op.eventId)) continue;
    if (op.kind === "changed") changed += 1;
    else added += 1;
    bars.push(op.bar);
    const at = slot(op.key);
    const entry = folded.get(at) ?? { changed: 0, added: 0, words: "" };
    if (op.kind === "changed") {
      if (entry.changed === 0) entry.words = op.words;
      entry.changed += 1;
    } else entry.added += 1;
    folded.set(at, entry);
  }

  const columns = new Map<string, ColumnMark>();
  for (const [key, entry] of folded) {
    const total = compact ? (repeats.get(baseOf(key)) ?? 1) : 1;
    columns.set(key, {
      status: entry.changed === 0 && entry.added === total ? "added" : "changed",
      words: entry.words,
      count: entry.changed + entry.added,
      total,
    });
  }

  const counts = [
    changed ? `${changed} changed` : "",
    added ? `${added} added` : "",
    removed ? `${removed} removed` : "",
  ].filter(Boolean);
  let line: string;
  if (counts.length === 0) line = sliced ? `Same as ${label} in these bars` : `Same as ${label}`;
  else {
    line = `Differs from ${label} in ${barWords(bars)}: ${counts.join(", ")}`;
    if (sliced) line += ", in these bars only";
  }

  return {
    columns,
    removals,
    removedAtEnd,
    line,
    any: columns.size > 0 || removals.size > 0 || removedAtEnd > 0,
    parentLabel: label,
  };
}
