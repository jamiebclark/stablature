/**
 * INV-025: comparing is bounded in edits, not time, and fast enough for the biggest parts.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_EDITS, alignColumns } from "@/lib/reading/align";
import { compareParts, compareVariants } from "@/lib/reading/compare";
import { TUNING_PRESETS } from "@/lib/tunings";
import { events, part } from "./compare-helpers";
import type { EventRow, PartRow } from "@/lib/model";

const isBar = (c: number) => c === 0;
const best = (run: () => void) => {
  let fastest = Infinity;
  for (let i = 0; i < 5; i += 1) {
    const start = performance.now();
    run();
    fastest = Math.min(fastest, performance.now() - start);
  }
  return fastest;
};
const asEvents = (frets: number[]): EventRow[] => events(frets.map((f) => String(f)).join(" "));

const col = (fret: number, over: Partial<EventRow> = {}) =>
  ({ id: `c${++serial}`, kind: "notes", frets: { "0": fret }, techniques: {}, repeat: 1, durationHint: null, tupletId: null, tupletCount: null, groupKind: null, ...over }) as unknown as EventRow;
let serial = 0;
const riff = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => col(f(i)));
const seeded = (seed: number) => {
  let state = seed;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32);
};
const strings = TUNING_PRESETS[0].strings.length;
const compare = (a: EventRow[], b: EventRow[]) =>
  compareParts({ part: { id: "p", label: "A" } as PartRow, events: a, annotations: [] }, { part: { id: "v", label: "B" } as PartRow, events: b, annotations: [] }, strings);

describe("budget", () => {
  it("20 variants of 1,000 columns, ten differences each, under 20 ms", () => {
    const base = Array.from({ length: 1000 }, (_, i) => (i * 7) % 23);
    const parts = [part("p", "A")];
    const by: Record<string, EventRow[]> = { p: asEvents(base) };
    for (let v = 0; v < 20; v += 1) {
      const changed = base.map((f, i) => (i % 100 === v ? f + 1 : f));
      parts.push(part(`v${v}`, "B", "p"));
      by[`v${v}`] = asEvents(changed);
    }
    const content = { parts, eventsByPart: by, annotationsByPart: {} } as never;
    expect(best(() => compareVariants(content, TUNING_PRESETS[0]))).toBeLessThan(20);
  });

  it("two unrelated parts of 5,000 columns, under 50 ms", () => {
    const a = asEvents(Array.from({ length: 5000 }, (_, i) => i % 31));
    const b = asEvents(Array.from({ length: 5000 }, (_, i) => (i * 3 + 1) % 29));
    const content = { parts: [part("p", "A"), part("v", "B", "p")], eventsByPart: { p: a, v: b }, annotationsByPart: {} } as never;
    expect(best(() => compareVariants(content, TUNING_PRESETS[0]))).toBeLessThan(50);
  });

  it("goes coarse one edit past the limit, and not at it", () => {
    const at = alignColumns(
      Int32Array.from({ length: MAX_EDITS }, (_, i) => 1 + (i % 2)),
      new Int32Array(0).fill(0),
      isBar,
    );
    expect(at.coarse).toBe(false);
    const a = Int32Array.from({ length: MAX_EDITS + 1 }, () => 1);
    const b = Int32Array.from({ length: MAX_EDITS + 1 }, () => 2);
    expect(alignColumns(a, b, isBar).coarse).toBe(true);
    expect(alignColumns(a.subarray(0, MAX_EDITS), b.subarray(0, MAX_EDITS), isBar).coarse).toBe(false);
  });

  it("reads no clock", () => {
    for (const file of ["align.ts", "compare.ts"]) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      expect(source).not.toMatch(/performance|Date/);
    }
  });

  it("two periodic riffs of 5,000 columns, under 50 ms", () => {
    const a = riff(5000, (i) => [1, 2, 3, 4][i % 4]);
    const b = riff(5000, (i) => [1, 3, 2, 5, 4][i % 5]);
    expect(best(() => compare(a, b))).toBeLessThan(50);
  });

  it("two parts sharing an alphabet of 5,000 columns, under 50 ms", () => {
    const next = seeded(3);
    const a = riff(5000, () => Math.floor(next() * 3));
    const b = riff(5000, () => Math.floor(next() * 3));
    expect(best(() => compare(a, b))).toBeLessThan(50);
  });

  // No figure in the spec covers this shape, so this only proves it is bounded.
  it("20 unrelated variants of 1,000 columns stay bounded", () => {
    const eventsByPart: Record<string, EventRow[]> = { p: riff(1000, (i) => i % 31) };
    const parts = [part("p", "A")];
    for (let v = 0; v < 20; v += 1) {
      eventsByPart[`v${v}`] = riff(1000, (i) => 40 + ((i * (v + 2)) % 29));
      parts.push(part(`v${v}`, "B", "p"));
    }
    const content = { parts, eventsByPart, annotationsByPart: {} } as never;
    expect(best(() => compareVariants(content, TUNING_PRESETS[0]))).toBeLessThan(1000);
  });

  it("a x512 repeat in each of 200 events stays bounded and accounts for every column", () => {
    const a = Array.from({ length: 200 }, (_, i) => col(i % 24, { repeat: 512 }));
    const b = Array.from({ length: 200 }, (_, i) => col((i + 1) % 24, { repeat: 512 }));
    expect(best(() => compare(a, b))).toBeLessThan(1000);
    expect(compare(a, b).ops.filter((o) => "from" in o).length).toBe(102400);
  });
});
