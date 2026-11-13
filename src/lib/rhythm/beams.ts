import type { Density, TabColumn, TupletSpan } from "@/lib/tab/layout";
import { TICKS_PER_BEAT, type DurationId } from "./durations";
import type { BarPosition } from "./notation";

/** What one layout column draws in the rhythm row. React-free; see contracts/beaming.md. */
export type RhythmMark =
  | { readonly kind: "none" }
  | {
      readonly kind: "note";
      readonly duration: DurationId;
      /** 0 for w, h, q; 1, 2 or 3 for 8, 16, 32. */
      readonly levels: 0 | 1 | 2 | 3;
      /** Flags drawn: `levels` when the note is in no run, else 0. */
      readonly flags: 0 | 1 | 2 | 3;
      /** Beam levels shared with the previous column. 0 when not joined. */
      readonly left: 0 | 1 | 2 | 3;
      /** Beam levels shared with the next column. 0 when not joined. */
      readonly right: 0 | 1 | 2 | 3;
      /** Levels above max(left, right) inside a run: drawn as stubs on `stubSide`. */
      readonly stubs: 0 | 1 | 2;
      readonly stubSide: "left" | "right" | null;
    }
  | { readonly kind: "rest"; readonly duration: DurationId };

type Level = 0 | 1 | 2 | 3;

const LEVELS: Record<DurationId, Level> = { w: 0, h: 0, q: 0, "8": 1, "16": 2, "32": 3 };

/** The unit a beamable column belongs to, or null when it cannot be beamed. */
function unitOf(column: TabColumn, positions: ReadonlyMap<string, BarPosition>, density: Density): string | null {
  if (column.kind !== "notes" || !column.duration) return null;
  if (LEVELS[column.duration.id] === 0) return null;
  if (density === "compact" && column.repeat > 1) return null;
  const at = positions.get(`${column.eventId}:${column.repetition}`);
  if (!at) return null;
  if (at.countedGroup) return `g:${at.countedGroup}`;
  return `b:${column.tupletId ?? ""}:${Math.floor(at.tick / TICKS_PER_BEAT)}`;
}

/** One mark per column. Never throws; anything it cannot read maps to `none`. */
export function rhythmMarks(
  columns: readonly TabColumn[],
  positions: ReadonlyMap<string, BarPosition>,
  density: Density,
): RhythmMark[] {
  const units = columns.map((c) => unitOf(c, positions, density));
  const levelOf = (i: number): Level => LEVELS[columns[i].duration!.id];
  const out: RhythmMark[] = [];
  for (let i = 0; i < columns.length; i++) {
    const c = columns[i];
    const d = c.duration;
    if (c.kind === "barline" || !d) {
      out.push({ kind: "none" });
      continue;
    }
    if (c.kind === "rest") {
      out.push({ kind: "rest", duration: d.id });
      continue;
    }
    if (c.kind !== "notes") {
      out.push({ kind: "none" });
      continue;
    }
    const levels = LEVELS[d.id];
    const unit = units[i];
    const joinsPrev = unit !== null && i > 0 && units[i - 1] === unit;
    const joinsNext = unit !== null && i + 1 < columns.length && units[i + 1] === unit;
    if (!joinsPrev && !joinsNext) {
      out.push({ kind: "note", duration: d.id, levels, flags: levels, left: 0, right: 0, stubs: 0, stubSide: null });
      continue;
    }
    const left = (joinsPrev ? Math.min(levels, levelOf(i - 1)) : 0) as Level;
    const right = (joinsNext ? Math.min(levels, levelOf(i + 1)) : 0) as Level;
    const stubs = (levels - Math.max(left, right)) as 0 | 1 | 2;
    out.push({
      kind: "note",
      duration: d.id,
      levels,
      flags: 0,
      left,
      right,
      stubs,
      stubSide: stubs > 0 ? (joinsPrev ? "left" : "right") : null,
    });
  }
  return out;
}

/** The one column index per group id that draws its number; a plain group has none. */
export function groupLabels(spans: readonly TupletSpan[]): ReadonlyMap<string, number> {
  const out = new Map<string, number>();
  const seen = new Set<string>();
  for (const s of spans) {
    if (seen.has(s.tupletId)) continue;
    seen.add(s.tupletId);
    if (s.count !== null) out.set(s.tupletId, Math.floor((s.start + s.end) / 2));
  }
  return out;
}
