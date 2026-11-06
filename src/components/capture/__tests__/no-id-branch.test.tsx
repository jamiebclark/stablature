// @vitest-environment jsdom
/**
 * INV-025. The suite's CaptureScreen check looks for one literal, `lit.has("stack")`. This one
 * cuts out `press` and the status line and looks for every id in LATCHES and COLUMN_PROPERTIES,
 * and renders LatchStrip and ColumnInspector with fabricated descriptors.
 */
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ColumnInspector } from "@/components/capture/ColumnInspector";
import { LatchStrip } from "@/components/capture/LatchStrip";
import { LATCHES, type Latch, type LatchId } from "@/lib/capture/latches";
import { COLUMN_PROPERTIES, type ColumnProperty, type PropertyContext } from "@/lib/capture/properties";

const ids = [...LATCHES.map((l) => l.id), ...COLUMN_PROPERTIES.map((p) => p.id)];
const read = (p: string) => readFileSync(p, "utf8");

function between(text: string, from: string, to: string) {
  const start = text.indexOf(from);
  const end = text.indexOf(to, start);
  expect(start, from).toBeGreaterThan(-1);
  expect(end, to).toBeGreaterThan(start);
  return text.slice(start, end);
}

describe("INV-025 source", () => {
  const screen = read("src/components/capture/CaptureScreen.tsx");
  const regions = {
    press: between(screen, "const press = useCallback(", "if (song === undefined"),
    status: between(screen, "const status = statusFor(lit)", "const toggleLatch"),
    statusLine: between(screen, ": status ||", "adding after the marked column"),
  };
  for (const [name, text] of Object.entries(regions)) {
    for (const id of ids) {
      it(`CaptureScreen ${name} names no ${id}`, () => {
        expect(text).not.toContain(`"${id}"`);
      });
    }
  }
  for (const path of ["src/components/capture/LatchStrip.tsx", "src/components/capture/ColumnInspector.tsx"]) {
    for (const id of ids) {
      it(`${path} names no ${id}`, () => {
        expect(read(path)).not.toContain(`"${id}"`);
      });
    }
  }
});

describe("INV-025 render", () => {
  const latch = (n: number): Latch => ({
    id: `fab${n}` as LatchId,
    label: `fab${n}`,
    title: `fab${n}`,
    ariaLabel: `fab${n}`,
    scope: "next-note",
    statusText: `fab${n}`,
  });
  for (const count of [1, 5]) {
    it(`LatchStrip draws ${count} fabricated latches`, () => {
      const latches = Array.from({ length: count }, (_, i) => latch(i));
      const view = render(
        <LatchStrip latches={latches} lit={new Set()} target={{ kind: "no-column" }} onToggle={() => {}} />,
      );
      expect(view.getByTestId("latch-strip").querySelectorAll("button")).toHaveLength(count);
      view.unmount();
    });
  }
  for (const count of [3, 7]) {
    it(`ColumnInspector draws ${count} fabricated properties`, () => {
      const properties = Array.from({ length: count }, (_, i): ColumnProperty => ({
        id: `fab${i}` as ColumnProperty["id"],
        label: `fab${i}`,
        ariaLabel: `fab${i}`,
        scope: "column-property",
        control: "action",
        destructive: false,
        read: () => null,
        commit: async () => {},
      }));
      const ctx = {
        part: { id: "p", bandId: "b" },
        event: { id: "e" },
        annotations: [],
      } as unknown as PropertyContext;
      const view = render(
        <ColumnInspector properties={properties} ctx={ctx} title="Column 1" onClose={() => {}} />,
      );
      expect(view.container.querySelectorAll("[data-property-row]")).toHaveLength(count);
      view.unmount();
    });
  }
});
