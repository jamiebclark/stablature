/**
 * INV-025 and SC-009, on columns that are not plain. SC-009 is "a song with 20 variants of 1,000 played
 * columns each, ten differences apiece, under 20 ms on a desktop". It does not say the columns are one fret
 * on one string, which is the only column `budget.test.ts` builds, and T073's fast path is for plain columns
 * only. So this runs the same song in every shape a real part takes, with the budget test's own method:
 * best of five, then best of thirty, on the tree and on the frozen copy from before T073.
 *
 * Wall-clock figures mean nothing beside a parallel run, so it runs only when asked, alone:
 *   PROBE_TIMING=1 npx vitest run --config specs/006-reading-aids/review-probes/vitest.probes.config.mts \n *     specs/006-reading-aids/review-probes/INV-025-a-song-that-is-not-plain.test.ts
 */
import { describe, expect, it } from "vitest";
import type { AnnotationRow, EventRow, PartRow } from "@/lib/model";
import { compareVariants } from "@/lib/reading/compare";
import { TUNING_PRESETS } from "@/lib/tunings";
import { compareVariants as compareBefore } from "./oracle-776c993/compare";

const tuning = TUNING_PRESETS[0];
let serial = 0;
const part = (id: string, variantOfPartId: string | null) => ({ id, label: id, variantOfPartId }) as unknown as PartRow;
const row = (over: Partial<EventRow>) =>
  ({
    id: `c${++serial}`, kind: "notes", frets: {}, techniques: {}, repeat: 1, durationHint: null, tupletId: null,
    tupletCount: null, groupKind: null, ...over,
  }) as unknown as EventRow;

type Shape = (fret: number, i: number) => Partial<EventRow>;
const chordFrets = (fret: number) => ({ "0": fret, "1": fret + 1, "2": fret + 2, "3": fret, "4": fret, "5": fret });
const SHAPES: [string, Shape][] = [
  ["one fret, as budget.test.ts builds it", (fret) => ({ frets: { "0": fret } })],
  ["six strings", (fret) => ({ frets: chordFrets(fret) })],
  ["a duration on every column", (fret) => ({ frets: { "0": fret }, durationHint: "8" })],
  ["six strings and a duration on every column", (fret) => ({ frets: chordFrets(fret), durationHint: "8" })],
  ["a technique on every column", (fret) => ({ frets: { "0": fret }, techniques: { "0": ["bend"] } as EventRow["techniques"] })],
  ["every column in a group", (fret, i) => ({ frets: { "0": fret }, tupletId: `g${Math.floor(i / 3)}`, tupletCount: 3, groupKind: "tuplet" })],
  [
    "a mix: durations, a technique in four, a group in five",
    (fret, i) => ({
      frets: chordFrets(fret),
      durationHint: "8",
      techniques: (i % 4 === 0 ? { "0": ["bend"] } : {}) as EventRow["techniques"],
      ...(i % 5 < 3 ? { tupletId: `g${Math.floor(i / 5)}`, tupletCount: 3, groupKind: "tuplet" as const } : {}),
    }),
  ],
];

function song(shape: Shape, chords: boolean) {
  const base = Array.from({ length: 1000 }, (_, i) => (i * 7) % 23);
  const parts = [part("p", null)];
  const rows = (frets: number[]) => frets.map((fret, i) => row(shape(fret, i)));
  const by: Record<string, EventRow[]> = { p: rows(base) };
  const annotations: Record<string, AnnotationRow[]> = {};
  const lay = (id: string) => {
    if (!chords) return;
    annotations[id] = by[id]
      .filter((_, i) => i % 8 === 0)
      .map((event) => ({ id: `n${++serial}`, partId: id, anchorEventId: event.id, kind: "chord", value: "Am" }) as unknown as AnnotationRow);
  };
  lay("p");
  for (let v = 0; v < 20; v += 1) {
    parts.push(part(`v${v}`, "p"));
    by[`v${v}`] = rows(base.map((f, i) => (i % 100 === v ? f + 1 : f)));
    lay(`v${v}`);
  }
  return { parts, eventsByPart: by, annotationsByPart: annotations } as never;
}

const best = (times: number, run: () => void) => {
  let fastest = Infinity;
  for (let i = 0; i < times; i += 1) {
    const start = performance.now();
    run();
    fastest = Math.min(fastest, performance.now() - start);
  }
  return fastest;
};

describe.runIf(process.env.PROBE_TIMING)("SC-009's song, in the shapes a real part takes", () => {
  for (const [name, shape] of SHAPES) {
    for (const chords of [false, true]) {
      it(`${name}${chords ? ", a chord every eight columns" : ""}`, () => {
        const content = song(shape, chords);
        const five = best(5, () => compareVariants(content, tuning));
        const thirty = best(30, () => compareVariants(content, tuning));
        const before = best(30, () => compareBefore(content, tuning));
        const fixed = (n: number) => n.toFixed(1).padStart(6);
        console.log(`now, best of 5 ${fixed(five)} ms | best of 30 ${fixed(thirty)} ms | before T073 ${fixed(before)} ms | ${name}${chords ? " + chords" : ""}`);
        expect(five).toBeLessThan(20);
      }, 60_000);
    }
  }
});
