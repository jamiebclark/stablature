// @vitest-environment jsdom
/**
 * INV-015: adding a latch or a column property never requires a layout change.
 *
 * Enumerated: LatchStrip at 1 and 5 latches; ColumnInspector at 3 and 6
 * properties; the no-id-branching check over both components. Stricter than the
 * suite's own test: it also compares every cell's className, which the suite's
 * "differs only in its armed/applicable modifier" test never reads.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Latch, LatchId } from "@/lib/capture/latches";
import type { ColumnProperty, PropertyContext } from "@/lib/capture/properties";
import type { CursorTarget } from "@/lib/capture/target";
import { LatchStrip } from "@/components/capture/LatchStrip";
import { ColumnInspector } from "@/components/capture/ColumnInspector";

const root = path.resolve(import.meta.dirname, "../../..");

const event = {
  id: "e1", bandId: "b", partId: "p", rank: "a", kind: "notes", frets: {}, techniques: {},
  repeat: 1, durationHint: null, tupletId: null, tupletCount: null,
  updatedAt: "", deletedAt: null, fieldClocks: {}, serverSeq: 0,
} as const;
const playable: CursorTarget = { kind: "playable", event: event as never };
const barline: CursorTarget = { kind: "barline", event: { ...event, kind: "barline" } as never };

const latches = (n: number): Latch[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `l${i}` as LatchId, label: `latch${i}`, ariaLabel: `latch ${i}`, title: `t${i}`,
    scope: "next-note", statusText: `s${i}`,
  }));

const CONTROLS = ["stepper", "text", "action"] as const;
const props = (n: number): ColumnProperty[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}` as ColumnProperty["id"], label: `prop${i}`, ariaLabel: `prop ${i}`,
    scope: "column-property", control: CONTROLS[i % 3], destructive: false,
    read: () => (CONTROLS[i % 3] === "stepper" ? 1 : null), commit: async () => {},
  }));
const ctx = { part: { id: "p", bandId: "b" }, event, annotations: [] } as unknown as PropertyContext;

describe("INV-015 LatchStrip", () => {
  const strip = (n: number, lit: string[] = [], target: CursorTarget = playable) =>
    render(
      <LatchStrip latches={latches(n)} lit={new Set(lit as LatchId[])} target={target} onToggle={() => {}} />,
    );

  it("1 vs 5 latches: same container className, one cell per latch, identical cell classes", () => {
    const one = strip(1);
    const oneBox = one.getByTestId("latch-strip");
    const oneCell = oneBox.querySelector("button")!.className;
    const oneStyle = oneBox.getAttribute("style");
    one.unmount();

    const five = strip(5);
    const fiveBox = five.getByTestId("latch-strip");
    const cells = [...fiveBox.querySelectorAll("button")];
    expect(cells).toHaveLength(5);
    expect(fiveBox.className).toBe(oneBox.className);
    expect(fiveBox.getAttribute("style")).toBe(oneStyle);
    for (const c of cells) expect(c.className).toBe(oneCell);
    five.unmount();
  });

  it("an armed cell differs only by the armed modifier, and an inapplicable cell stays in place", () => {
    const r = strip(5, ["l2"]);
    const cells = [...r.getByTestId("latch-strip").querySelectorAll("button")];
    const base = cells[0].className.split(/\s+/);
    const armed = cells[2].className.split(/\s+/);
    const added = armed.filter((c) => !base.includes(c));
    const removed = base.filter((c) => !armed.includes(c));
    expect(added.sort()).toEqual(["bg-accent", "border-accent", "text-accent-text"]);
    expect(removed.sort()).toEqual(["bg-bg-raised", "border-border-subtle", "text-text"].sort());
    r.unmount();

    const dead = strip(5, [], barline);
    const deadCells = [...dead.getByTestId("latch-strip").querySelectorAll("button")];
    expect(deadCells).toHaveLength(5);
    for (const c of deadCells) expect(c.disabled).toBe(true);
    dead.unmount();
  });
});

describe("INV-015 ColumnInspector", () => {
  it("3 vs 6 properties: same container className, one row per property, identical row classes", () => {
    const a = render(<ColumnInspector properties={props(3)} ctx={ctx} title="Column 1" onClose={() => {}} />);
    const aRoot = a.getByTestId("column-inspector");
    const aRows = [...aRoot.querySelectorAll("[data-property-row]")];
    expect(aRows).toHaveLength(3);
    const cls = aRoot.className;
    const rowCls = aRows[0].className;
    a.unmount();

    const b = render(<ColumnInspector properties={props(6)} ctx={ctx} title="Column 1" onClose={() => {}} />);
    const bRoot = b.getByTestId("column-inspector");
    const bRows = [...bRoot.querySelectorAll("[data-property-row]")];
    expect(bRows).toHaveLength(6);
    expect(bRoot.className).toBe(cls);
    for (const r of bRows) expect(r.className).toBe(rowCls);
  });
});

describe("INV-015 no component branches on a descriptor id", () => {
  for (const file of ["src/components/capture/LatchStrip.tsx", "src/components/capture/ColumnInspector.tsx"]) {
    it(file, () => {
      const src = readFileSync(path.join(root, file), "utf8");
      expect(src).not.toMatch(/\.id\s*[!=]==/);
      expect(src).not.toMatch(/\bid\s*[!=]==/);
      expect(src).not.toMatch(/switch\s*\([^)]*\bid\s*\)/);
      expect(src).not.toMatch(/case\s+["'](stack|repeat|chord|delete)["']/);
    });
  }
});
