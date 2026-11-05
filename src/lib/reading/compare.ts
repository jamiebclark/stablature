/**
 * What a variant changed against the part it declares as its parent. Derived on read from content
 * alone: no id, clock, random value or object order enters the result.
 */

import type { AnnotationRow, EventRow, PartRow } from "../model";
import { stringCount, type Tuning } from "../tunings";
import { readDuration } from "../rhythm/durations";
import { DECORATIONS, TRANSITIONS } from "../tab/techniques";
import type { SongContent } from "../local/queries";
import { alignColumns } from "./align";
import { columnKey, playedColumns, type ColumnParts, type Interner, type PlayedColumn } from "./played";

export interface PartInput {
  part: PartRow;
  events: readonly EventRow[];
  annotations: readonly AnnotationRow[];
}

export type Op =
  | { kind: "same"; from: number; to: number }
  | {
      kind: "changed";
      from: number;
      to: number;
      words: string;
      eventId: string;
      key: string;
      bar: number;
    }
  | { kind: "added"; to: number; eventId: string; key: string; bar: number }
  | { kind: "removed"; from: number; bar: number; before: string | null };

export interface VariantComparison {
  parent: PartRow;
  ops: Op[];
  /** True if the search ran out of budget. Nothing is drawn differently; it exists for tests. */
  coarse: boolean;
}

const TECHNIQUE_WORDS = new Map<string, string>([
  ...TRANSITIONS.map((t) => [t.id, t.words] as const),
  ...DECORATIONS.map((d) => [d.id, d.words] as const),
]);

function durationWords(value: string | null): string {
  if (value === null) return "unset";
  const known = readDuration(value);
  return known ? known.words.replace(/ note$/, "") : value;
}

function wordsFor(p: ColumnParts, v: ColumnParts): string {
  const words: string[] = [];
  if (p.kind !== v.kind) words.push(`${p.kind} to ${v.kind}`);
  const strings = Math.max(p.frets.length, v.frets.length);
  for (let i = 0; i < strings; i += 1) {
    const before = p.frets[i] ?? null;
    const after = v.frets[i] ?? null;
    if (before === after) continue;
    if (before !== null && after !== null) words.push(`fret ${before} to fret ${after} on string ${i + 1}`);
    else if (after !== null) words.push(`fret ${after} added on string ${i + 1}`);
    else words.push(`fret ${before} removed on string ${i + 1}`);
  }
  for (let i = 0; i < strings; i += 1) {
    const before = p.techniques[i] ?? [];
    const after = v.techniques[i] ?? [];
    for (const id of after) {
      if (!before.includes(id)) words.push(`${TECHNIQUE_WORDS.get(id) ?? id} added on string ${i + 1}`);
    }
    for (const id of before) {
      if (!after.includes(id)) words.push(`${TECHNIQUE_WORDS.get(id) ?? id} removed on string ${i + 1}`);
    }
  }
  if (p.duration !== v.duration) {
    words.push(`duration ${durationWords(p.duration)} to ${durationWords(v.duration)}`);
  }
  if (p.group !== v.group) words.push("group changed");
  if (p.chord !== v.chord) {
    if (p.chord && v.chord) words.push(`chord ${p.chord} to ${v.chord}`);
    else if (v.chord) words.push(`chord ${v.chord} added`);
    else words.push(`chord ${p.chord} removed`);
  }
  return words.join(", ");
}

/**
 * Where an edit sits among equal columns is a free choice for the alignment (a note removed from `7 7 7 7 7 7`
 * may be any of them), so take the position that leaves the fewest continuation mismatches: a matched column
 * that follows its matched neighbour in both parts, and joins its group in one and not the other. A block of
 * added or removed columns slides through the equal columns beside it; the count is kept up one step at a time,
 * and only a strictly better position beats where the alignment put it, so the answer never depends on anything
 * but the two parts.
 */
function settleEdits(
  matches: readonly (readonly [number, number])[],
  parent: readonly PlayedColumn[],
  variant: readonly PlayedColumn[],
): [number, number][] {
  const m = matches.map(([f, t]): [number, number] => [f, t]);
  const mismatch = (k: number) => {
    if (k <= 0 || k >= m.length) return 0;
    const [pf, pt] = m[k - 1];
    const [f, t] = m[k];
    return f === pf + 1 && t === pt + 1 && parent[f].joined !== variant[t].joined ? 1 : 0;
  };
  // axis 0 slides a removal through the parent, axis 1 an addition through the variant.
  const settle = (k: number, axis: 0 | 1) => {
    const seq = axis === 0 ? parent : variant;
    const other = 1 - axis;
    const prev = k > 0 ? m[k - 1] : ([-1, -1] as const);
    const end = axis === 0 ? parent.length : variant.length;
    const nextAt = k < m.length ? m[k][axis] : end;
    const L = nextAt - prev[axis] - 1;
    // The moves: each shifts one matched column across the block.
    const walk = (dir: 1 | -1) => {
      const moved: number[] = [];
      let running = 0;
      let best = 0;
      let bestSteps = 0;
      for (let step = 0; ; step += 1) {
        const x = dir === 1 ? k + step : k - 1 - step;
        if (x < 0 || x >= m.length) break;
        const here = m[x];
        const into = here[axis] - dir * L;
        if (dir === 1 ? step > 0 && here[axis] !== m[x - 1][axis] + L + 1 : step > 0 && here[axis] !== m[x + 1][axis] - L - 1) break;
        if (step > 0 && here[other] !== m[dir === 1 ? x - 1 : x + 1][other] + dir) break;
        if (seq[into].content !== seq[here[axis]].content) break;
        const touched = dir === 1 ? [x, x + 1] : [x, x + 1];
        const old = mismatch(touched[0]) + mismatch(touched[1]);
        here[axis] = into;
        moved.push(x);
        running += mismatch(touched[0]) + mismatch(touched[1]) - old;
        if (running < best) {
          best = running;
          bestSteps = step + 1;
        }
      }
      return { moved, best, bestSteps };
    };
    const undo = (moved: number[], keep: number, dir: 1 | -1) => {
      for (let i = moved.length - 1; i >= keep; i -= 1) m[moved[i]][axis] += dir * L;
    };
    const right = walk(1);
    undo(right.moved, 0, 1);
    const left = walk(-1);
    undo(left.moved, 0, -1);
    if (right.best === 0 && left.best === 0) return;
    // Fewest mismatches, then the shorter move, then to the left.
    const goLeft = left.best < right.best || (left.best === right.best && left.bestSteps <= right.bestSteps);
    const chosen = goLeft ? left : right;
    const dir = goLeft ? -1 : 1;
    // Replay the chosen walk, in the order it took, up to its best.
    for (let i = 0; i < chosen.bestSteps; i += 1) m[chosen.moved[i]][axis] -= dir * L;
  };
  for (let k = 0; k <= m.length; k += 1) {
    const prev = k > 0 ? m[k - 1] : ([-1, -1] as const);
    const next = k < m.length ? m[k] : ([parent.length, variant.length] as const);
    if (next[0] - prev[0] > 1 && next[1] - prev[1] === 1) settle(k, 0);
    else if (next[1] - prev[1] > 1 && next[0] - prev[0] === 1) settle(k, 1);
  }
  return m;
}

function buildOps(
  parent: readonly PlayedColumn[],
  variant: readonly PlayedColumn[],
  barlines: ReadonlySet<number>,
): { ops: Op[]; coarse: boolean } {
  const isBarline = (content: number) => barlines.has(content);
  const aligned = alignColumns(
    Int32Array.from(parent, (c) => c.content),
    Int32Array.from(variant, (c) => c.content),
    isBarline,
  );
  const { coarse } = aligned;
  const matches = settleEdits(aligned.matches, parent, variant);

  const ops: Op[] = [];
  const changedOp = (p: number, v: number, words: string): Op => {
    const to = variant[v];
    return {
      kind: "changed",
      from: p,
      to: v,
      words,
      eventId: to.eventId,
      key: columnKey(to.eventId, to.repetition),
      bar: to.bar,
    };
  };
  const pair = (p: number, v: number) => {
    if (parent[p].content === variant[v].content) ops.push({ kind: "same", from: p, to: v });
    else ops.push(changedOp(p, v, wordsFor(parent[p].parts(), variant[v].parts())));
  };
  const added = (v: number) => {
    const to = variant[v];
    ops.push({ kind: "added", to: v, eventId: to.eventId, key: columnKey(to.eventId, to.repetition), bar: to.bar });
  };
  const removed = (p: number) => ops.push({ kind: "removed", from: p, bar: 1, before: null });

  let p = 0;
  let v = 0;
  const run = (pEnd: number, vEnd: number) => {
    while (p < pEnd || v < vEnd) {
      if (p < pEnd && v < vEnd) {
        const pb = isBarline(parent[p].content);
        const vb = isBarline(variant[v].content);
        if (pb === vb) {
          pair(p, v);
          p += 1;
          v += 1;
        } else if (pb) {
          removed(p);
          p += 1;
        } else {
          added(v);
          v += 1;
        }
      } else if (p < pEnd) {
        removed(p);
        p += 1;
      } else {
        added(v);
        v += 1;
      }
    }
  };
  for (const [f, t] of matches) {
    run(f, t);
    ops.push({ kind: "same", from: f, to: t });
    p = f + 1;
    v = t + 1;
  }
  run(parent.length, variant.length);

  // Continuation: neighbours matched in step, but one joins its group and the other does not.
  const original = ops.map((op) => op.kind);
  for (let i = 1; i < ops.length; i += 1) {
    const op = ops[i];
    const before = ops[i - 1];
    if (op.kind !== "same" || original[i - 1] !== "same" || before.kind !== "same") continue;
    if (op.to !== before.to + 1 || op.from !== before.from + 1) continue;
    if (parent[op.from].joined === variant[op.to].joined) continue;
    ops[i] = changedOp(op.from, op.to, "group changed");
  }

  // A removal sits before the next variant column, or at the end.
  let next: number | null = null;
  for (let i = ops.length - 1; i >= 0; i -= 1) {
    const op = ops[i];
    if (op.kind === "removed") {
      if (next === null) {
        op.before = null;
        op.bar = variant.length > 0 ? variant[variant.length - 1].bar : 1;
      } else {
        op.before = columnKey(variant[next].eventId, variant[next].repetition);
        op.bar = variant[next].bar;
      }
    } else next = op.to;
  }
  return { ops, coarse };
}

const BARLINE = "barline";

function interning() {
  const table = new Map<string, number>();
  const packed = new Map<number, number>();
  let count = 0;
  const intern: Interner = (s: string) => {
    let id = table.get(s);
    if (id === undefined) {
      id = count;
      count += 1;
      table.set(s, id);
    }
    return id;
  };
  intern.packed = (key: number) => {
    let id = packed.get(key);
    if (id === undefined) {
      id = count;
      count += 1;
      packed.set(key, id);
    }
    return id;
  };
  return { intern, barlines: () => new Set<number>(table.has(BARLINE) ? [table.get(BARLINE)!] : []) };
}

export function compareParts(parent: PartInput, variant: PartInput, strings: number): VariantComparison {
  const { intern, barlines } = interning();
  const a = playedColumns(parent.events, parent.annotations, strings, intern);
  const b = playedColumns(variant.events, variant.annotations, strings, intern);
  return { parent: parent.part, ...buildOps(a, b, barlines()) };
}

/** An entry for each part whose declared parent is another live part of this song. */
export function compareVariants(
  content: SongContent,
  tuning: Tuning,
): ReadonlyMap<string, VariantComparison> {
  const strings = stringCount(tuning);
  const { intern, barlines } = interning();
  const byId = new Map(content.parts.map((part) => [part.id, part]));
  const cache = new Map<string, PlayedColumn[]>();
  const played = (part: PartRow) => {
    let columns = cache.get(part.id);
    if (!columns) {
      columns = playedColumns(
        content.eventsByPart[part.id] ?? [],
        content.annotationsByPart[part.id] ?? [],
        strings,
        intern,
      );
      cache.set(part.id, columns);
    }
    return columns;
  };

  const out = new Map<string, VariantComparison>();
  for (const part of content.parts) {
    const parentId = part.variantOfPartId;
    if (parentId === null || parentId === part.id) continue;
    const parent = byId.get(parentId);
    if (!parent) continue;
    const a = played(parent);
    const b = played(part);
    out.set(part.id, { parent, ...buildOps(a, b, barlines()) });
  }
  return out;
}
