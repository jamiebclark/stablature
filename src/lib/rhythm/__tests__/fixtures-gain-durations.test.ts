/**
 * INV-001, INV-002, SC-008 over H, the set the plan names: every recorded `layoutPart` fixture x
 * {expanded, compact}, recorded as `harvest.test.ts` does, x each of D on every column and D cycled,
 * through `toAscii`, `songToText`, the layout, `countBars` and `expandedLength`.
 *
 * `fixtures-gain-durations.test.ts` says it runs "over H" and holds one hand fixture, with neither
 * export in it.
 */
import "fake-indexeddb/auto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { TabStaff } from "@/components/tab/TabStaff";
import type { ArrangementEntryRow, EventRow, PartRow } from "@/lib/model";
import type { LayoutOptions } from "@/lib/tab/layout";

const recorded = vi.hoisted(() => ({ on: true, calls: [] as unknown[] }));

vi.mock("@/lib/tab/layout", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tab/layout")>();
  return {
    ...actual,
    layoutPart: (options: LayoutOptions) => {
      if (recorded.on) recorded.calls.push(options);
      return actual.layoutPart(options);
    },
  };
});

import "@/lib/tab/__tests__/ascii.test";
import "@/lib/tab/__tests__/grouping.test";
import "@/lib/tab/__tests__/techniques.test";
import "@/lib/tab/__tests__/techniques-repeat.test";
import "@/lib/tab/__tests__/techniques-plain.test";
import "@/lib/tab/__tests__/techniques-layout-invariants.test";
import "@/lib/export/__tests__/text.test";

type Actual = typeof import("@/lib/tab/layout");
type Ascii = typeof import("@/lib/tab/ascii");
type Text = typeof import("@/lib/export/text");

const D = ["w", "h", "q", "8", "16", "32"] as const;
const DENSITIES = ["expanded", "compact"] as const;

describe("over H, after every harvested file has run", () => {
  let actual: Actual;
  let ascii: Ascii;
  let text: Text;
  let harvest: LayoutOptions[] = [];

  beforeAll(async () => {
    recorded.on = false;
    actual = await vi.importActual<Actual>("@/lib/tab/layout");
    ascii = await vi.importActual<Ascii>("@/lib/tab/ascii");
    text = await vi.importActual<Text>("@/lib/export/text");
    harvest = recorded.calls as LayoutOptions[];
  });

  const gain = (events: readonly EventRow[], pick: (i: number) => string) =>
    events.map((e, i) => ({
      ...e,
      durationHint: (e.kind === "barline" ? null : pick(i)) as EventRow["durationHint"],
    }));

  const bare = (events: readonly EventRow[]) =>
    events.map((e) => ({ ...e, durationHint: null as EventRow["durationHint"] }));

  /** The shape the staff is drawn from, with the two fields this entry adds set aside. */
  const shape = (options: LayoutOptions, density: (typeof DENSITIES)[number]) =>
    actual.layoutPart({ ...options, density }).columns.map((c) => {
      const copy: Record<string, unknown> = { ...c };
      delete copy.duration;
      delete copy.description;
      return copy;
    });

  const asSong = (options: LayoutOptions, events: readonly EventRow[]) => {
    const part = { id: "p", label: "A", name: null, variantOfPartId: null } as unknown as PartRow;
    const entry = {
      id: "e",
      kind: "part",
      partId: "p",
      repeat: 2,
      fromBar: null,
      toBar: null,
      lastRepeatPartId: null,
      label: null,
    } as unknown as ArrangementEntryRow;
    return {
      song: { title: "Dirge", bpm: 120, notes: null },
      tuning: options.tuning,
      parts: [part],
      eventsByPart: { p: [...events] },
      annotationsByPart: { p: [...(options.annotations ?? [])] },
      entries: [entry],
    };
  };

  it("a part gains durations and nothing it draws or writes moves", () => {
    expect(harvest.length).toBeGreaterThan(100);
    let compared = 0;
    for (const options of harvest) {
      const plain = bare(options.events);
      const variants = [
        ...D.map((d) => gain(options.events, () => d)),
        gain(options.events, (i) => D[i % 6]),
      ];
      for (const density of DENSITIES) {
        const base = { ...options, events: plain };
        const wantAscii = ascii.toAscii({ ...base, density });
        const wantText = text.songToText(asSong(options, plain), { density });
        const wantShape = shape(base, density);
        for (const events of variants) {
          const next = { ...options, events };
          expect(ascii.toAscii({ ...next, density })).toBe(wantAscii);
          expect(text.songToText(asSong(options, events), { density })).toBe(wantText);
          expect(shape(next, density)).toEqual(wantShape);
          expect(actual.countBars(events)).toBe(actual.countBars(plain));
          expect(actual.expandedLength(events)).toBe(actual.expandedLength(plain));
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThan(1000);
  }, 300_000);

  it("TabStaff with showRhythm on equals off, on a part with no durations", () => {
    for (const options of harvest) {
      for (const density of DENSITIES) {
        const props = {
          events: bare(options.events),
          tuning: options.tuning,
          annotations: options.annotations ?? [],
          density,
        };
        expect(renderToStaticMarkup(createElement(TabStaff, { ...props, showRhythm: true }))).toBe(
          renderToStaticMarkup(createElement(TabStaff, { ...props, showRhythm: false })),
        );
      }
    }
  }, 300_000);

  it("a part with no durations: no field but `duration: null`, and no description changes", () => {
    for (const options of harvest) {
      for (const density of DENSITIES) {
        const columns = actual.layoutPart({ ...options, events: bare(options.events), density }).columns;
        for (const c of columns) {
          expect(c.duration).toBeNull();
          expect(c.description).not.toMatch(/(whole|half|quarter|eighth|sixteenth|thirty-second) note/);
        }
      }
    }
  }, 300_000);
});
