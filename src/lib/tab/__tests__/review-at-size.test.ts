import "fake-indexeddb/auto";

/** INV-030: never does a long paste freeze typing or the screen. Reading, at every size it names. */
import { describe, expect, it } from "vitest";
import { draftPart } from "@/lib/local/clipboard";
import type { EventRow } from "@/lib/model";
import { toAscii } from "@/lib/tab/ascii";
import { layoutPart } from "@/lib/tab/layout";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const tuning = presetById("bass4-e")!;
const context = { tuning, bandTunings: [], songEvents: [] };

const event = (i: number): EventRow =>
  ({
    id: `e${i}`,
    bandId: "b",
    partId: "p",
    rank: `a${String(i).padStart(5, "0")}`,
    kind: "notes",
    frets: { [String(i % 4)]: (i % 9) + 1 },
    techniques: {},
    repeat: i % 7 === 0 ? 2 : 1,
    durationHint: null,
    tupletId: null,
    tupletCount: null,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
  }) as EventRow;

const events = Array.from({ length: 2000 }, (_, i) => event(i));

function timed(text: string) {
  const start = performance.now();
  const reading = readTab(text, context);
  const ms = performance.now() - start;
  expect(reading.kind).toBe("ready");
  return ms;
}

describe("2,000 columns", () => {
  for (const density of ["expanded", "compact"] as const) {
    it(`one system, ${density}`, () => {
      const ms = timed(toAscii({ events, tuning, density }));
      console.log(`one system ${density}: ${ms.toFixed(1)} ms`);
      expect(ms).toBeLessThan(500);
    });

    it(`40 systems, ${density}`, () => {
      const systems = Array.from({ length: 40 }, (_, s) =>
        toAscii({ events: events.slice(s * 50, s * 50 + 50), tuning, density }),
      );
      const ms = timed(systems.join("\n\n"));
      console.log(`40 systems ${density}: ${ms.toFixed(1)} ms`);
      expect(ms).toBeLessThan(500);
    });
  }

  it("the whole preview path: read, draft, lay out", () => {
    const text = toAscii({ events, tuning, density: "expanded" });
    const start = performance.now();
    const reading = readTab(text, context);
    if (reading.kind !== "ready") throw new Error("not ready");
    const rows = draftPart(reading.clipboard);
    layoutPart({ events: rows.events, tuning, density: "expanded" });
    const ms = performance.now() - start;
    console.log(`read + draft + layout: ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(800);
  });
});

describe("lyrics are linear, not quadratic", () => {
  const lyric = (n: number) =>
    Array.from({ length: n }, (_, i) => `la la la ${i}`).join("\n");

  it("5,000 lines take about ten times what 500 take", () => {
    const run = (n: number) => {
      const text = lyric(n);
      readTab(text, context);
      const start = performance.now();
      for (let k = 0; k < 5; k += 1) readTab(text, context);
      return (performance.now() - start) / 5;
    };
    const small = run(500);
    const large = run(5000);
    console.log(`500 lines ${small.toFixed(2)} ms, 5,000 lines ${large.toFixed(2)} ms`);
    expect(large).toBeLessThan(Math.max(small * 40, 60));
  });

  it("5,000 lines beside a staff", () => {
    const staff = toAscii({ events: events.slice(0, 20), tuning });
    const text = `${lyric(5000)}\n\n${staff}\n\n${lyric(5000)}`;
    const ms = timed(text);
    console.log(`10,000 lyric lines and a staff: ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(500);
  });
});
