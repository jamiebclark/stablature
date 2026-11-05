/**
 * Round 2: `settleEdits` (T058) moves matched pairs after the alignment. The round 1 sweeps cannot reach it: the 5,000
 * pairs of INV-022 and INV-023 carry no groups, so every `joined` is false, no position beats another, and the slide
 * never moves a thing. These run it, on grouped columns, and check what it must not break.
 *
 *  - INV-021: every group shape of a run of equal columns × every position × {remove, add}: exactly the one edit.
 *  - INV-022, 023, 024 on random grouped pairs, several edits each: every `same` pair really is equal, the ops cover
 *    both parts in order, the edits are the plain table's minimum, and a second run gives the same ops.
 */
import { describe, expect, it } from "vitest";
import type { EventRow, PartRow } from "@/lib/model";
import { compareParts, type Op } from "@/lib/reading/compare";
import { playedColumns } from "@/lib/reading/played";
import { TUNING_PRESETS } from "@/lib/tunings";

const strings = TUNING_PRESETS[0].strings.length;
let serial = 0;
const col = (fret: number, group: string | null, over: Partial<EventRow> = {}) =>
  ({
    id: `s${++serial}`,
    kind: "notes",
    frets: { "0": fret },
    techniques: {},
    repeat: 1,
    durationHint: null,
    tupletId: group,
    tupletCount: group ? 3 : null,
    groupKind: group ? "tuplet" : null,
    ...over,
  }) as unknown as EventRow;
const bar = () => col(0, null, { kind: "barline", frets: {} } as Partial<EventRow>);
const P = { id: "p", label: "A" } as PartRow;
const V = { id: "v", label: "B" } as PartRow;
const compare = (a: readonly EventRow[], b: readonly EventRow[]) =>
  compareParts({ part: P, events: a, annotations: [] }, { part: V, events: b, annotations: [] }, strings);
const tally = (ops: readonly Op[]) => ({
  changed: ops.filter((o) => o.kind === "changed").length,
  added: ops.filter((o) => o.kind === "added").length,
  removed: ops.filter((o) => o.kind === "removed").length,
});

/** Every way of cutting `n` equal columns into plain columns and groups. */
function shapes(n: number): (number | null)[][] {
  const out: (number | null)[][] = [];
  const go = (row: (number | null)[], next: number) => {
    if (row.length === n) {
      out.push(row);
      return;
    }
    go([...row, null], next);
    go([...row, next], next + 1);
    const last = row[row.length - 1];
    if (last !== null && last !== undefined) go([...row, last], next);
  };
  go([], 1);
  return out;
}

describe("INV-021 every group shape of a run of equal columns", () => {
  for (const n of [2, 3, 4, 5, 6, 7]) {
    it(`${n} columns: remove and add at every position`, () => {
      const bad: string[] = [];
      for (const shape of shapes(n)) {
        const parent = shape.map((g) => col(7, g === null ? null : `g${g}`));
        for (let at = 0; at < n; at += 1) {
          const removed = tally(compare(parent, parent.filter((_, i) => i !== at)).ops);
          if (removed.removed !== 1 || removed.changed + removed.added !== 0) {
            bad.push(`remove ${at} of ${JSON.stringify(shape)}: ${JSON.stringify(removed)}`);
          }
        }
        for (let at = 0; at <= n; at += 1) {
          // Added plain, or into the group on its left, or the group on its right.
          const homes = new Set([null, shape[at - 1] ?? null, shape[at] ?? null]);
          for (const home of homes) {
            const variant = [...parent.slice(0, at), col(7, home === null ? null : `g${home}`), ...parent.slice(at)];
            const added = tally(compare(parent, variant).ops);
            if (added.added !== 1 || added.changed + added.removed !== 0) {
              bad.push(`add ${home} at ${at} of ${JSON.stringify(shape)}: ${JSON.stringify(added)}`);
            }
          }
        }
      }
      expect(bad.slice(0, 12)).toEqual([]);
    });
  }
});

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function randomPart(r: () => number, length: number, alphabet: number) {
  const out: EventRow[] = [];
  let group: string | null = null;
  for (let i = 0; i < length; i += 1) {
    if (r() < 0.1) {
      group = null;
      out.push(bar());
      continue;
    }
    const roll = r();
    if (roll < 0.25) group = `r${++serial}`;
    else if (roll < 0.45) group = null;
    out.push(col(1 + Math.floor(r() * alphabet), group));
  }
  return out;
}

/** A second part a few edits from the first. */
function mutate(r: () => number, from: readonly EventRow[], alphabet: number) {
  const out = from.map((e) => ({ ...e, id: `s${++serial}` }) as EventRow);
  const edits = 1 + Math.floor(r() * 5);
  for (let e = 0; e < edits; e += 1) {
    const at = Math.floor(r() * (out.length + 1));
    const roll = r();
    if (roll < 0.45 && out.length > 0) out.splice(Math.min(at, out.length - 1), 1);
    else if (roll < 0.9) out.splice(at, 0, col(1 + Math.floor(r() * alphabet), out[at - 1]?.tupletId ?? null));
    else if (out.length > 0) {
      const i = Math.min(at, out.length - 1);
      if (out[i].kind !== "barline") out[i] = { ...out[i], tupletId: r() < 0.5 ? null : `r${++serial}` } as EventRow;
    }
  }
  return out;
}

const minimumEdits = (a: readonly number[], b: readonly number[], isBar: (x: number) => boolean) => {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const held = row[j];
      const sub = a[i - 1] === b[j - 1] ? 0 : isBar(a[i - 1]) !== isBar(b[j - 1]) ? 1e9 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + sub);
      diagonal = held;
    }
  }
  return row[b.length];
};

describe("the slide keeps what the alignment promised, on grouped columns", () => {
  it("20,000 grouped pairs", { timeout: 120_000 }, () => {
    const r = rng(20261105);
    let continuations = 0;
    for (let round = 0; round < 20_000; round += 1) {
      const alphabet = 1 + Math.floor(r() * 3);
      const a = randomPart(r, 2 + Math.floor(r() * 14), alphabet);
      const b = mutate(r, a, alphabet);
      const { ops } = compare(a, b);
      const table = new Map<string, number>();
      const intern = (s: string) => {
        if (!table.has(s)) table.set(s, table.size);
        return table.get(s)!;
      };
      const pa = playedColumns(a, [], strings, intern);
      const pb = playedColumns(b, [], strings, intern);
      const barId = table.get("barline");
      const ctx = () =>
        JSON.stringify({ a: pa.map((c) => [c.content, c.joined]), b: pb.map((c) => [c.content, c.joined]), ops });

      // INV-024: each column of both parts once, in order.
      let from = 0;
      let to = 0;
      for (const op of ops) {
        if (op.kind !== "added") {
          if (op.from !== from) throw new Error(`parent order: ${ctx()}`);
          from += 1;
        }
        if (op.kind !== "removed") {
          if (op.to !== to) throw new Error(`variant order: ${ctx()}`);
          to += 1;
        }
        // A same pair is equal, and a barline only ever sits with a barline.
        if (op.kind === "same" && pa[op.from].content !== pb[op.to].content) throw new Error(`same but unequal: ${ctx()}`);
        if (op.kind === "changed" && (pa[op.from].content === barId) !== (pb[op.to].content === barId)) {
          throw new Error(`barline paired: ${ctx()}`);
        }
      }
      if (from !== pa.length || to !== pb.length) throw new Error(`lost a column: ${ctx()}`);

      // INV-022: content changes, added and removed are the true minimum. A changed op between equal columns comes
      // from the continuation pass, on top of the alignment, so it is not counted here.
      const edits = ops.filter(
        (o) =>
          o.kind === "added" ||
          o.kind === "removed" ||
          (o.kind === "changed" && pa[o.from].content !== pb[o.to].content),
      ).length;
      const minimum = minimumEdits(
        pa.map((c) => c.content),
        pb.map((c) => c.content),
        (x) => x === barId,
      );
      if (edits !== minimum) throw new Error(`edits ${edits} against minimum ${minimum}: ${ctx()}`);
      if (ops.some((o) => o.kind === "changed" && o.words === "group changed")) continuations += 1;

      // INV-023: the same two parts, the same answer.
      if (JSON.stringify(compare(a, b).ops) !== JSON.stringify(ops)) throw new Error(`second run differs: ${ctx()}`);
    }
    // The sweep must reach the code it is here for.
    expect(continuations).toBeGreaterThan(100);
  });
});
