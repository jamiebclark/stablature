/**
 * INV-001 / INV-002 / INV-018: frets draw, export and describe exactly as they did before 006.
 *
 * Compares `layoutPart`, `TabStaff` markup (base and raised surface, showRhythm on and off), `toAscii`,
 * `songToText` and the column descriptions against baseline.json, hashes recorded from UNEDITED code
 * (T001). This probe guards unchanged behaviour: it was run green against the pre-change tree before T008
 * and must stay green. Perturbing any baseline entry makes it fail (checked once, then reverted).
 * The `reading` prop does not exist on TabStaff yet; the "frets with no marks" markup variant is added with it.
 */
import "fake-indexeddb/auto";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
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

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 24);
let harvest: LayoutOptions[] = [];


const baseline = JSON.parse(
  readFileSync(new URL("./baseline.json", import.meta.url), "utf8"),
) as { entries: Record<string, Record<string, string>> };

describe("frets are unchanged (INV-001, INV-002, INV-018), after every harvested file has run", () => {
  beforeAll(() => {
    recorded.on = false;
    harvest = recorded.calls as LayoutOptions[];
  });

  it("matches every baseline entry", async () => {
    const actual = await vi.importActual<typeof import("@/lib/tab/layout")>("@/lib/tab/layout");
    const ascii = await vi.importActual<typeof import("@/lib/tab/ascii")>("@/lib/tab/ascii");
    const { songToText } = await import("@/lib/export/text");
    const { TabStaff } = await import("@/components/tab/TabStaff");
    const seen = new Map<string, LayoutOptions>();
    for (const o of harvest) seen.set(JSON.stringify(o), o);
    expect(seen.size).toBeGreaterThan(0);
    const bad: string[] = [];
    let checked = 0;
    for (const [key, o] of seen) {
      const id = sha(key);
      for (const density of ["expanded", "compact"] as const) {
        const opts = { ...o, density };
        const layout = actual.layoutPart(opts);
        const row: Record<string, string> = {
          layout: sha(JSON.stringify(layout)),
          descriptions: sha(JSON.stringify(layout.columns.map((c) => c.description))),
          ascii: sha(ascii.toAscii(opts)),
        };
        for (const surface of ["base", "raised"] as const) {
          for (const showRhythm of [false, true]) {
            const html = renderToStaticMarkup(
              createElement(TabStaff, {
                events: o.events,
                tuning: o.tuning,
                annotations: o.annotations,
                density,
                surface,
                showRhythm,
              }),
            );
            row[`markup:${surface}:${showRhythm ? "rhythm" : "plain"}`] = sha(html);
          }
        }
        row.songText = sha(
          songToText(
            {
              song: { title: "T", bpm: null, notes: null },
              tuning: o.tuning,
              parts: [{ id: "p", bandId: "b", songId: "s", label: "A", name: null, rank: "a", variantOfPartId: null, notes: null, updatedAt: "x", deletedAt: null, fieldClocks: {}, serverSeq: 0 }],
              eventsByPart: { p: [...o.events] },
              annotationsByPart: { p: [...(o.annotations ?? [])] },
              entries: [{ id: "e", bandId: "b", songId: "s", rank: "a", kind: "part", partId: "p", repeat: 1, fromBar: null, toBar: null, lastRepeatPartId: null, label: null, updatedAt: "x", deletedAt: null, fieldClocks: {}, serverSeq: 0 }],
            } as never,
            { density },
          ),
        );
        const want = baseline.entries[`${id}:${density}`];
        if (!want) {
          bad.push(`${id}:${density} missing`);
          continue;
        }
        for (const [field, hash] of Object.entries(row)) {
          checked++;
          // RECORD_MARKUP=1 re-records ONLY markup entries (007 T018); every other field must still match.
          if (process.env.RECORD_MARKUP === "1" && field.startsWith("markup:")) {
            want[field] = hash;
            continue;
          }
          if (want[field] !== hash) bad.push(`${id}:${density}:${field}`);
        }
      }
    }
    if (process.env.RECORD_MARKUP === "1") {
      writeFileSync(new URL("./baseline.json", import.meta.url), JSON.stringify(baseline, null, 1) + "\n");
    }
    expect(bad.slice(0, 10)).toEqual([]);
    expect(checked).toBe(Object.keys(baseline.entries).length * 8);
  }, 300000);

  it("ascii.ts and text.ts import nothing from src/lib/reading", () => {
    for (const f of ["src/lib/tab/ascii.ts", "src/lib/export/text.ts"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/lib\/reading|\.\.\/reading/);
    }
  });
});
