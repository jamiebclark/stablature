// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ColumnProperty, PropertyContext } from "@/lib/capture/properties";
import { ColumnInspector } from "../ColumnInspector";

const ctx = { part: { id: "p", bandId: "b" }, event: { id: "e1" }, annotations: [] } as unknown as PropertyContext;

function toggles(commit: ColumnProperty["commit"]): ColumnProperty {
  return {
    id: "decorations",
    label: "techniques",
    ariaLabel: "note techniques",
    scope: "column-property",
    control: "toggles",
    destructive: false,
    read: () => null,
    commit,
    toggles: () => [
      {
        stringIndex: 2,
        label: "A",
        toggles: ["vib", "harm"].map((label, i) => ({
          value: { stringIndex: 2, decoration: i ? "harmonic" : "vibrato" } as const,
          label,
          ariaLabel: `${label} on A1`,
          on: i === 0,
        })),
      },
    ],
  };
}

function others(n: number): ColumnProperty[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `x${i}` as ColumnProperty["id"],
    label: `x${i}`,
    ariaLabel: `x${i}`,
    scope: "column-property",
    control: "action",
    destructive: false,
    read: () => null,
    commit: async () => {},
  }));
}

describe("ColumnInspector toggles", () => {
  for (const extra of [2, 6]) {
    it(`renders pressed state and commits the descriptor value (${extra + 1} properties)`, () => {
      const commit = vi.fn(async () => {});
      const view = render(
        <ColumnInspector
          properties={[...others(extra), toggles(commit)]}
          ctx={ctx}
          title="Column 1"
          onClose={() => {}}
        />,
      );
      expect(view.getByTestId("decoration-group").getAttribute("data-string")).toBe("2");
      expect(view.getByLabelText("vib on A1").getAttribute("aria-pressed")).toBe("true");
      expect(view.getByLabelText("harm on A1").getAttribute("aria-pressed")).toBe("false");
      fireEvent.click(view.getByLabelText("harm on A1"));
      expect(commit).toHaveBeenCalledWith(ctx, { stringIndex: 2, decoration: "harmonic" });
    });
  }
});
