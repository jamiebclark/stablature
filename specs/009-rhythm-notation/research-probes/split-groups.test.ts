/**
 * Research R6: does any layout harvested by `frets-unchanged.test.ts` hold one group drawn as two spans
 * (a legacy group across a barline)? If none does, drawing a group's number once per group cannot move a
 * baseline markup hash. Prints the count; asserts nothing about the answer.
 */
import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
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

describe("R6 split groups in the baseline harvest", () => {
  it("counts layouts where one group id has more than one span", async () => {
    recorded.on = false;
    const actual = await vi.importActual<typeof import("@/lib/tab/layout")>("@/lib/tab/layout");
    let split = 0;
    let total = 0;
    for (const o of recorded.calls as LayoutOptions[]) {
      for (const density of ["expanded", "compact"] as const) {
        total++;
        const spans = actual.tupletSpans(actual.layoutPart({ ...o, density }));
        const ids = spans.map((s) => s.tupletId);
        if (new Set(ids).size !== ids.length) split++;
      }
    }
    console.log(`R6: ${split} of ${total} harvested layouts draw a group as more than one span`);
    expect(total).toBeGreaterThan(0);
  });
});
