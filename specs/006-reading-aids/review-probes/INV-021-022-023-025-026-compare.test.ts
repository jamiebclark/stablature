/**
 * The comparison through `compareParts`, `compareVariants` and `listSongContent`.
 *
 * INV-021: an edit beside an equal column, where the alignment has a choice and `joined` is not in the signature.
 * INV-022: the difference count against a plain table, through the op list the page actually draws from,
 *          at lengths and barline densities the suite's 12-column sweep does not reach.
 * INV-023: barlines, order, repeat runs, shuffled maps and rows.
 * INV-025: every member of the set, including the three `budget.test.ts` leaves out.
 * INV-026: **Par** through real rows.
 */
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HlcClock } from "@/lib/hlc";
import { newId } from "@/lib/ids";
import { StablatureDb } from "@/lib/local/db";
import {
  appendNote, createBand, createPart, createSong, createTuningFromPreset, createVariant,
} from "@/lib/local/editing";
import { deleteRow, patchRow } from "@/lib/local/mutate";
import { listSongContent } from "@/lib/local/queries";
import type { AnnotationRow, EventRow, PartRow } from "@/lib/model";
import { MAX_EDITS, alignColumns } from "@/lib/reading/align";
import { compareParts, compareVariants, type Op } from "@/lib/reading/compare";
import { staffMarks } from "@/lib/reading/marks";
import { TUNING_PRESETS, presetById } from "@/lib/tunings";

const tuning = TUNING_PRESETS[0];
const strings = tuning.strings.length;
let serial = 0;
const col = (fret: number, over: Partial<EventRow> = {}) =>
  ({ id: `c${++serial}`, kind: "notes", frets: { "0": fret }, techniques: {}, repeat: 1, durationHint: null, tupletId: null, tupletCount: null, groupKind: null, ...over }) as unknown as EventRow;
const bar = () => col(0, { kind: "barline", frets: {} } as Partial<EventRow>);
const grouped = (group: string, ...frets: number[]) => frets.map((f) => col(f, { tupletId: group, tupletCount: 3, groupKind: "tuplet" }));
const P = { id: "p", label: "A" } as PartRow;
const V = { id: "v", label: "B" } as PartRow;
const compare = (a: readonly EventRow[], b: readonly EventRow[], an: readonly AnnotationRow[] = [], bn: readonly AnnotationRow[] = []) =>
  compareParts({ part: P, events: a, annotations: an }, { part: V, events: b, annotations: bn }, strings);
const lineOf = (a: readonly EventRow[], b: readonly EventRow[]) =>
  staffMarks(compare(a, b), { events: b, fromBar: null, toBar: null, density: "expanded" }).line;
const counts = (ops: readonly Op[]) => ({
  changed: ops.filter((o) => o.kind === "changed").length,
  added: ops.filter((o) => o.kind === "added").length,
  removed: ops.filter((o) => o.kind === "removed").length,
});

describe("INV-021 an edit beside an equal column reports itself", () => {
  const triplets = () => [...grouped("g1", 7, 7, 7), ...grouped("g2", 7, 7, 7)];

  it("removing one note of a run of triplets of one note", () => {
    const parent = triplets();
    const variant = parent.filter((_, i) => i !== 2);
    expect(lineOf(parent, variant)).toBe("Differs from A in bar 1: 1 removed");
  });
  it("removing the first note of the second triplet", () => {
    const parent = triplets();
    const variant = parent.filter((_, i) => i !== 3);
    expect(lineOf(parent, variant)).toBe("Differs from A in bar 1: 1 removed");
  });
  it("adding a note to the first triplet", () => {
    const parent = triplets();
    const variant = [...parent.slice(0, 3), col(7, { tupletId: "g1", tupletCount: 3, groupKind: "tuplet" }), ...parent.slice(3)];
    expect(lineOf(parent, variant)).toBe("Differs from A in bar 1: 1 added");
  });
  it("adding a note between the two triplets", () => {
    const parent = triplets();
    const variant = [...parent.slice(0, 3), col(7), ...parent.slice(3)];
    expect(lineOf(parent, variant)).toBe("Differs from A in bar 1: 1 added");
  });
  it("removing a note of a two-note figure across two groups", () => {
    const parent = [...grouped("a", 5, 7), ...grouped("b", 5, 7), ...grouped("c", 5, 7)];
    const variant = [...parent.slice(0, 2), ...parent.slice(3)];
    expect(lineOf(parent, variant)).toBe("Differs from A in bar 1: 1 removed");
  });
  it("removing a whole triplet leaves the other unmarked", () => {
    const parent = triplets();
    expect(lineOf(parent, parent.slice(3))).toBe("Differs from A in bar 1: 3 removed");
  });
});

/** The page's own numbers against a table: the op list, not a re-derivation of it. */
const seeded = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
};
const BAR = -1;
function table(a: number[], b: number[]) {
  const D = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) D[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) D[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const sub = a[i - 1] === b[j - 1] ? 0 : (a[i - 1] === BAR) !== (b[j - 1] === BAR) ? Infinity : 1;
      D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + sub);
    }
  }
  return D[a.length][b.length];
}
const rows = (list: number[]) => list.map((n) => (n === BAR ? bar() : col(n)));

describe("INV-022 never above the true minimum, through the op list", () => {
  it.each([
    ["the plan's set: up to 12 columns", 5000, 12, 0.2],
    ["longer", 3000, 40, 0.2],
    ["mostly barlines", 3000, 24, 0.6],
    ["barlines only beside notes of one alphabet", 3000, 30, 0.45],
  ])("%s", (_name, pairs, length, barlines) => {
    const next = seeded(11 + length);
    for (let n = 0; n < pairs; n += 1) {
      const alphabet = 2 + Math.floor(next() * 5);
      const make = () => Array.from({ length: Math.floor(next() * (length + 1)) }, () => (next() < barlines ? BAR : 1 + Math.floor(next() * alphabet)));
      const a = make();
      const b = make();
      const { ops, coarse } = compare(rows(a), rows(b));
      const got = ops.filter((o) => o.kind !== "same").length;
      expect(coarse).toBe(false);
      if (got !== table(a, b)) throw new Error(`${a} / ${b}: ${got}, table says ${table(a, b)}`);
      // INV-023 on the same pairs: order, and a barline never in a change.
      let lastFrom = -1;
      let lastTo = -1;
      for (const op of ops) {
        if ("from" in op) {
          expect(op.from).toBeGreaterThan(lastFrom);
          lastFrom = op.from;
        }
        if ("to" in op) {
          expect(op.to).toBeGreaterThan(lastTo);
          lastTo = op.to;
        }
        if (op.kind === "changed") expect(a[op.from] === BAR || b[op.to] === BAR).toBe(false);
      }
    }
  });
  it("a b c d e against e f g h i", () => {
    expect(counts(compare(rows([1, 2, 3, 4, 5]), rows([5, 6, 7, 8, 9])).ops)).toEqual({ changed: 5, added: 0, removed: 0 });
  });
});

describe("INV-023 the same two parts, the same result", () => {
  const stripped = (ops: readonly Op[]) => JSON.stringify(ops.map((o) => ({ kind: o.kind, from: "from" in o ? o.from : null, to: "to" in o ? o.to : null })));

  it("a barline at each position on each side, and the worked example", () => {
    const base = [5, 7, 8, 5, 7, 8];
    for (let i = 0; i <= base.length; i += 1) {
      const withBar = [...base.slice(0, i), BAR, ...base.slice(i)];
      expect(counts(compare(rows(base), rows(withBar)).ops)).toEqual({ changed: 0, added: 1, removed: 0 });
      expect(counts(compare(rows(withBar), rows(base)).ops)).toEqual({ changed: 0, added: 0, removed: 1 });
    }
    const worked = compare(rows([5, 7, 8, BAR, 5, 7, 8]), rows([5, 7, 8, BAR, 5, 7, 9, 10])).ops.filter((o) => o.kind !== "same");
    expect(worked.map((o) => o.kind)).toEqual(["changed", "added"]);
  });

  it("a riff with one column inserted at every equally valid position", () => {
    const riff = [1, 2, 3, 1, 2, 3, 1, 2, 3];
    for (let at = 0; at <= riff.length; at += 1) {
      for (const inserted of [1, 2, 3]) {
        const variant = [...riff.slice(0, at), inserted, ...riff.slice(at)];
        const first = compare(rows(riff), rows(variant));
        expect(first.ops.filter((o) => o.kind !== "same").length).toBe(1);
        expect(stripped(compare(rows(riff), rows(variant)).ops)).toBe(stripped(first.ops));
      }
    }
  });

  it("object key order and annotation row order do not move a result", () => {
    const events = [col(5, { frets: { "0": 5, "1": 7 }, techniques: { "0": ["bend", "palm_mute"] } as never }), col(7)];
    const shuffled = [col(5, { frets: { "1": 7, "0": 5 }, techniques: { "0": ["palm_mute", "bend"] } as never }), col(7)];
    const notes = (list: readonly EventRow[]) => [
      { id: "1", kind: "chord", anchorEventId: list[0].id, value: "Am" },
      { id: "2", kind: "chord", anchorEventId: list[1].id, value: "F" },
    ] as AnnotationRow[];
    const a = compare(events, shuffled, notes(events), notes(shuffled).reverse());
    expect(counts(a.ops)).toEqual({ changed: 0, added: 0, removed: 0 });
  });

  it("two chords on one anchor, rows in either order, read as one result", () => {
    const events = [col(5)];
    const copy = [col(5)];
    const two = (id: string) => [
      { id: "1", kind: "chord", anchorEventId: id, value: "Am" },
      { id: "2", kind: "chord", anchorEventId: id, value: "Dm" },
    ] as AnnotationRow[];
    const same = compare(events, copy, two(events[0].id), two(copy[0].id).reverse());
    expect(counts(same.ops)).toEqual({ changed: 0, added: 0, removed: 0 });
  });
});

const best = (run: () => void, times = 5) => {
  let fastest = Infinity;
  for (let i = 0; i < times; i += 1) {
    const start = performance.now();
    run();
    fastest = Math.min(fastest, performance.now() - start);
  }
  return fastest;
};
const song = (partsOf: Record<string, EventRow[]>, parentId = "p") => {
  const parts = Object.keys(partsOf).map((id) => ({ id, label: id, variantOfPartId: id === parentId ? null : parentId }) as PartRow);
  return { parts, eventsByPart: partsOf, annotationsByPart: {} } as unknown as Parameters<typeof compareVariants>[0];
};

describe("INV-025 every member of the budget set", () => {
  const report: Record<string, number> = {};
  const longRiff = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => col(f(i)));

  it("SC-009: 20 variants of 1,000, ten differences each, in 20 ms", () => {
    const base = Array.from({ length: 1000 }, (_, i) => (i * 7) % 23);
    const partsOf: Record<string, EventRow[]> = { p: base.map((f) => col(f)) };
    for (let v = 0; v < 20; v += 1) partsOf[`v${v}`] = base.map((f, i) => col(i % 100 === v ? f + 1 : f));
    report["SC-009"] = best(() => compareVariants(song(partsOf), tuning), 15);
    expect(report["SC-009"]).toBeLessThan(20);
  });
  it("SC-010: two unrelated parts of 5,000 in 50 ms, every column accounted for", () => {
    const a = longRiff(5000, (i) => i % 31);
    const b = longRiff(5000, (i) => 40 + ((i * 3 + 1) % 29));
    report["SC-010"] = best(() => compare(a, b));
    const result = compare(a, b);
    expect(result.coarse).toBe(true);
    expect(result.ops.length).toBe(5000);
    expect(report["SC-010"]).toBeLessThan(50);
  });
  it("two periodic riffs of 5,000", () => {
    const a = longRiff(5000, (i) => [1, 2, 3, 4][i % 4]);
    const b = longRiff(5000, (i) => [1, 3, 2, 5, 4][i % 5]);
    report.periodic = best(() => compare(a, b));
    expect(report.periodic).toBeLessThan(50);
  });
  it("two parts sharing an alphabet", () => {
    const next = seeded(3);
    const a = longRiff(5000, () => Math.floor(next() * 3));
    const b = longRiff(5000, () => Math.floor(next() * 3));
    report.shared = best(() => compare(a, b));
    expect(report.shared).toBeLessThan(50);
  });
  // No figure in the spec or contract covers this shape, so this only proves it is bounded. research R-budget
  // predicted about 50 ms; 200 to 292 ms was measured, which is a follow-up rather than a violated invariant.
  it("20 unrelated variants of 1,000 stay bounded", () => {
    const partsOf: Record<string, EventRow[]> = { p: longRiff(1000, (i) => i % 31) };
    for (let v = 0; v < 20; v += 1) partsOf[`v${v}`] = longRiff(1000, (i) => 40 + ((i * (v + 2)) % 29));
    report.unrelated20 = best(() => compareVariants(song(partsOf), tuning));
    expect(report.unrelated20).toBeLessThan(1000);
  });
  it("where the 20 unrelated variants' time goes: one alignment, alone", () => {
    const a = Int32Array.from({ length: 1000 }, (_, i) => i % 31);
    const b = Int32Array.from({ length: 1000 }, (_, i) => 40 + ((i * 2) % 29));
    report.oneAlignment1000 = best(() => alignColumns(a, b, () => false), 9);
    expect(report.oneAlignment1000).toBeGreaterThan(0);
  });
  it("a x512 repeat in each of 200 events", () => {
    const a = Array.from({ length: 200 }, (_, i) => col(i % 24, { repeat: 512 }));
    const b = Array.from({ length: 200 }, (_, i) => col((i + 1) % 24, { repeat: 512 }));
    report.x512 = best(() => compare(a, b), 3);
    const result = compare(a, b);
    expect(result.ops.filter((o) => "from" in o).length).toBe(102400);
    expect(report.x512).toBeLessThan(1000);
  });
  it("exactly MAX_EDITS, and one past it, still accounts for every column", () => {
    const isBar = () => false;
    const at = alignColumns(Int32Array.from({ length: MAX_EDITS }, () => 1), Int32Array.from({ length: MAX_EDITS }, () => 2), isBar);
    const past = alignColumns(Int32Array.from({ length: MAX_EDITS + 1 }, () => 1), Int32Array.from({ length: MAX_EDITS + 1 }, () => 2), isBar);
    expect([at.coarse, past.coarse]).toEqual([false, true]);
    const a = longRiff(MAX_EDITS + 1, () => 1);
    const b = longRiff(MAX_EDITS + 1, () => 2);
    const { ops, coarse } = compare(a, b);
    expect(coarse).toBe(true);
    expect(ops.map((o) => ("from" in o ? o.from : -1))).toEqual(a.map((_, i) => i));
  });
  it("reports what it measured", () => {
    writeFileSync(
      path.join(tmpdir(), "spec006-inv025.json"),
      JSON.stringify(Object.fromEntries(Object.entries(report).map(([k, v]) => [k, Number(v.toFixed(2))]))),
    );
    expect(Object.keys(report).length).toBeGreaterThan(5);
  });
});

describe("INV-026 Par through real rows", () => {
  it("is keyed by exactly the parts with another live part of this song as a parent", async () => {
    const db = new StablatureDb(`probe-${newId()}`);
    await db.open();
    let now = 1_000_000;
    const clock = new HlcClock("probe", () => (now += 1));
    const ctx = { db, clock };
    const band = await createBand("Hollow Crown", ctx);
    const row = await createTuningFromPreset(band.id, presetById("bass5-b")!, true, ctx);
    const song1 = await createSong(band.id, "One", row.id, ctx);
    const song2 = await createSong(band.id, "Two", row.id, ctx);
    const A = await createPart(song1, ctx);
    await appendNote(A, 3, 5, ctx);
    const plain = await createPart(song1, ctx);
    const B = await createVariant(A, ctx);
    const C = await createVariant(B, ctx);
    const ofDeleted = await createVariant(A, ctx);
    const deleted = await createPart(song1, ctx);
    const other = await createPart(song2, ctx);
    const elsewhere = await createVariant(A, ctx);
    const self = await createVariant(A, ctx);
    const noRow = await createVariant(A, ctx);
    const set = (id: string, variantOfPartId: string) => patchRow("parts", id, { variantOfPartId }, ctx);
    await set(ofDeleted.id, deleted.id);
    await set(elsewhere.id, other.id);
    await set(self.id, self.id);
    await set(noRow.id, "no-such-part");
    await deleteRow("parts", deleted.id, ctx);

    const compared = compareVariants(await listSongContent(song1.id, db), row);
    expect(new Set(compared.keys())).toEqual(new Set([B.id, C.id]));
    expect(compared.has(plain.id)).toBe(false);
    expect(compared.get(B.id)!.parent.id).toBe(A.id);
    // A chain compares with its own parent and nothing further up.
    expect(compared.get(C.id)!.parent.id).toBe(B.id);
  });
});
