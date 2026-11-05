/**
 * T073 gave a plain column a packed number and left every other column on the string signature. Two ways
 * of numbering a column can only agree if a column the first cannot number never has the same signature as
 * one it can, so this checks the two ways against the code as it stood before them.
 *
 * - **Pairs**: every pair from a set of columns, through `compareParts`, reads Same exactly when the
 *   signature before T073 was equal. Valid columns first, then the shapes off the type, sorted by whether
 *   the wire lets them reach a device.
 * - **Songs**: `compareVariants` deep-equals the frozen copy in `oracle-776c993/`, over seeded songs holding
 *   every kind of column, across tuning sizes either side of `pack`'s eight strings.
 * - **Words**: `Column.parts()` keeps the repetition the closure before it had.
 * - **Twins**: an exhaustive sweep of `pack`'s digits, so no two frets share a number, and the eight-string cap.
 */
import { describe, expect, it } from "vitest";
import type { AnnotationRow, EventRow, PartRow } from "@/lib/model";
import { compareParts, compareVariants } from "@/lib/reading/compare";
import { eventRowSchema } from "@/lib/sync/protocol";
import type { Tuning } from "@/lib/tunings";
import { compareVariants as compareBefore } from "./oracle-776c993/compare";
import { signatureOf as signatureBefore } from "./oracle-776c993/played";

let serial = 0;
const col = (over: Partial<EventRow> = {}) =>
  ({
    id: `c${++serial}`, kind: "notes", frets: {}, techniques: {}, repeat: 1, durationHint: null,
    tupletId: null, tupletCount: null, groupKind: null, ...over,
  }) as unknown as EventRow;
const P = { id: "p", label: "A" } as unknown as PartRow;
const V = { id: "v", label: "B" } as unknown as PartRow;
const reportsSame = (a: EventRow, b: EventRow, strings: number) =>
  compareParts({ part: P, events: [a], annotations: [] }, { part: V, events: [b], annotations: [] }, strings).ops.every(
    (op) => op.kind === "same",
  );

const FRETS: (number | "x" | undefined)[] = [undefined, 0, 1, 7, 36, "x"];
const TECHNIQUES: (string[] | undefined)[] = [undefined, [], ["bend"], ["bend", "bend"], ["bend", "vibrato"], ["vibrato", "bend"]];

function validColumns(): EventRow[] {
  const out: EventRow[] = [];
  for (const kind of ["notes", "rest"] as const) {
    for (const durationHint of [null, "8", "q"] as const) {
      for (const tupletId of [null, "g"]) {
        for (const first of FRETS) {
          for (const second of FRETS) {
            for (const technique of TECHNIQUES) {
              const frets: Record<string, number | "x"> = {};
              if (first !== undefined) frets["0"] = first;
              if (second !== undefined) frets["1"] = second;
              out.push(
                col({
                  kind,
                  durationHint,
                  tupletId,
                  tupletCount: tupletId ? 3 : null,
                  frets,
                  techniques: technique ? { "0": technique } as EventRow["techniques"] : {},
                }),
              );
            }
          }
        }
      }
    }
  }
  return out;
}

/** One of each class under the old signature is enough for a pair sweep: more would only repeat it. */
function byOldSignature(columns: EventRow[], strings: number): EventRow[] {
  const seen = new Map<string, EventRow>();
  for (const column of columns) {
    const signature = signatureBefore(column, strings, "");
    if (!seen.has(signature)) seen.set(signature, column);
  }
  return [...seen.values()];
}

describe("T073 pairs: Same exactly when the signature before T073 was equal", () => {
  for (const strings of [1, 2, 6, 8, 9]) {
    it(`every valid column against every other, ${strings} strings`, () => {
      const columns = validColumns();
      // Every column against each class: a class holds columns of both paths, so this crosses them.
      const classes = byOldSignature(columns, strings);
      let pairs = 0;
      const wrong: string[] = [];
      for (const a of columns) {
        const sa = signatureBefore(a, strings, "");
        for (const b of classes) {
          pairs += 1;
          const want = sa === signatureBefore(b, strings, "");
          if (reportsSame(a, b, strings) !== want && wrong.length < 5) wrong.push(`${JSON.stringify(a)} / ${JSON.stringify(b)}`);
        }
      }
      expect(wrong).toEqual([]);
      expect(pairs).toBeGreaterThan(10_000);
    }, 280_000);
  }
});

describe("T073 pairs: shapes off the type", () => {
  const plain = () => col({ frets: { "0": 7 } });
  const shape = eventRowSchema.shape;

  // Neither of these can reach a device: `applyRemoteRows` drops a row the schema refuses, and nothing in
  // the app writes one. Before T073 each read Same as plain 7; now each reads changed. Pinned here so that
  // loosening the schema is what would make them matter.
  it("the wire refuses a fret held as text and an empty-string duration", () => {
    expect(shape.frets.safeParse({ "0": "7" }).success).toBe(false);
    expect(shape.durationHint.safeParse("").success).toBe(false);
    expect(shape.tupletId.safeParse("").success).toBe(false);
  });

  // This one can: the schema takes any short string as a technique. F28.
  it("the wire accepts an empty-string technique", () => {
    expect(shape.techniques.safeParse({ "0": [""] }).success).toBe(true);
  });
  it("an empty-string technique reads as it did before T073", () => {
    const odd = col({ frets: { "0": 7 }, techniques: { "0": [""] } as unknown as EventRow["techniques"] });
    expect(signatureBefore(plain(), 6, "")).toBe(signatureBefore(odd, 6, ""));
    expect(reportsSame(plain(), odd, 6)).toBe(true);
  });
  it("an empty-string group id reads as it did before T073", () => {
    expect(reportsSame(plain(), col({ frets: { "0": 7 }, tupletId: "" }), 6)).toBe(true);
  });
});

function seeded(seed: number) {
  let state = seed;
  return () => (state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

function song(random: () => number, strings: number) {
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  const fret = () => (random() < 0.1 ? "x" : Math.floor(random() * 5) * 3);
  const column = (): EventRow => {
    const roll = random();
    if (roll < 0.08) return col({ kind: "barline" });
    if (roll < 0.14) return col({ kind: "rest", durationHint: pick([null, "8"]) });
    const frets: Record<string, number | "x"> = {};
    for (let s = 0; s < strings; s += 1) if (random() < 0.4) frets[String(s)] = fret();
    const techniques: Record<string, string[]> = {};
    if (random() < 0.2) techniques["0"] = pick([[], ["bend"], ["vibrato", "bend"], ["bend", "bend"]]);
    const tupletId = random() < 0.2 ? pick(["g1", "g2"]) : null;
    return col({
      frets,
      techniques: techniques as EventRow["techniques"],
      repeat: random() < 0.1 ? 3 : 1,
      durationHint: pick([null, null, null, "8", "16"]),
      tupletId,
      tupletCount: tupletId ? pick([3, 5, null]) : null,
      groupKind: tupletId ? pick(["tuplet", "plain", null]) : null,
    });
  };
  const edit = (rows: EventRow[]) => {
    const out = rows.map((r) => ({ ...r, id: `c${++serial}` }));
    for (let i = 0; i < 1 + Math.floor(random() * 4); i += 1) {
      const at = Math.floor(random() * (out.length + 1));
      const roll = random();
      if (roll < 0.34) out.splice(at, 0, column());
      else if (roll < 0.67) out.splice(at, 1);
      else if (at < out.length) out[at] = column();
    }
    return out;
  };
  const chords = (rows: EventRow[], partId: string) =>
    rows
      .filter(() => random() < 0.15)
      .map((r) => ({ id: `n${++serial}`, partId, anchorEventId: r.id, kind: "chord", value: pick(["Am", " Am ", "", "   ", "G7", "N.C."]) })) as unknown as AnnotationRow[];

  const a = Array.from({ length: 2 + Math.floor(random() * 24) }, column);
  const b = edit(a);
  const c = edit(b);
  return {
    parts: [
      { id: "a", label: "A", variantOfPartId: null },
      { id: "b", label: "B", variantOfPartId: "a" },
      { id: "c", label: "C", variantOfPartId: "b" },
    ] as unknown as PartRow[],
    eventsByPart: { a, b, c },
    annotationsByPart: { a: chords(a, "a"), b: chords(b, "b"), c: chords(c, "c") },
  };
}

describe("T073 songs: compareVariants equals the code before it", () => {
  for (const strings of [1, 4, 6, 8, 9, 12]) {
    it(`2,000 seeded songs on ${strings} strings`, () => {
      const tuning = { strings: Array.from({ length: strings }, () => "E2") } as unknown as Tuning;
      const random = seeded(strings * 7919);
      let changed = 0;
      for (let i = 0; i < 2000; i += 1) {
        const content = song(random, strings) as never;
        const now = compareVariants(content, tuning);
        const then = compareBefore(content, tuning);
        expect([...now.keys()]).toEqual([...then.keys()]);
        for (const [key, value] of now) {
          expect(value).toEqual(then.get(key));
          changed += value.ops.filter((op) => op.kind === "changed").length;
        }
      }
      // A sweep that compared nothing would pass, so insist it saw real differences.
      expect(changed).toBeGreaterThan(500);
    }, 280_000);
  }
});

describe("T073 words: a column keeps its own repetition", () => {
  it("a repeated column names its chord on the first pass only", () => {
    const a = col({ frets: { "0": 5 }, repeat: 2 });
    const b = col({ frets: { "0": 7 }, repeat: 2 });
    const chord = (anchor: EventRow, value: string) =>
      [{ id: `n${++serial}`, anchorEventId: anchor.id, kind: "chord", value }] as unknown as AnnotationRow[];
    const { ops } = compareParts(
      { part: P, events: [a], annotations: chord(a, "Am") },
      { part: V, events: [b], annotations: chord(b, "G") },
      6,
    );
    expect(ops.map((op) => (op.kind === "changed" ? op.words : op.kind))).toEqual([
      "fret 5 to fret 7 on string 1, chord Am to G",
      "fret 5 to fret 7 on string 1",
    ]);
  });
});

describe("T073 twins: no two frets share a number", () => {
  it("every fret 0 to 70 and x on each of eight strings, against every other on that string", () => {
    const values: (number | "x")[] = [...Array.from({ length: 71 }, (_, i) => i), "x"];
    for (let s = 0; s < 8; s += 1) {
      for (const a of values) {
        for (const b of values) {
          const same = reportsSame(col({ frets: { [String(s)]: a } }), col({ frets: { [String(s)]: b } }), 8);
          if (same !== (a === b)) throw new Error(`string ${s}: ${a} against ${b} read ${same ? "Same" : "changed"}`);
        }
      }
    }
  }, 120_000);

  // Past eight strings the number would need more than 53 bits, so the low strings would round away.
  it("one fret apart on any string, with every other string held high, from 1 to 12 strings", () => {
    for (let strings = 1; strings <= 12; strings += 1) {
      const full: Record<string, number | "x"> = {};
      for (let s = 0; s < strings; s += 1) full[String(s)] = 36;
      for (let s = 0; s < strings; s += 1) {
        for (const kind of ["notes", "rest"] as const) {
          const a = col({ kind, frets: { ...full } });
          const b = col({ kind, frets: { ...full, [String(s)]: 35 } });
          if (reportsSame(a, b, strings)) throw new Error(`${strings} strings, string ${s}, ${kind}: read Same`);
        }
      }
    }
  });

  it("a note on the top string never meets a rest or a note on the next", () => {
    expect(reportsSame(col({ kind: "rest" }), col({ frets: {} }), 8)).toBe(false);
    expect(reportsSame(col({ frets: { "0": 0 } }), col({ frets: { "1": 0 } }), 8)).toBe(false);
    expect(reportsSame(col({ kind: "rest", frets: { "7": 64 } }), col({ frets: { "6": 1 } }), 8)).toBe(false);
  });
});
