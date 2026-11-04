// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ColumnProperty, PropertyContext } from "@/lib/capture/properties";
import { ColumnInspector } from "../ColumnInspector";

const ctx = {
  part: { id: "part-1", bandId: "band-1" },
  event: { id: "e1", repeat: 1 },
  annotations: [],
} as unknown as PropertyContext;

const CONTROLS = ["stepper", "text", "action"] as const;

function makeProperties(count: number): readonly ColumnProperty[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `prop-${i}` as ColumnProperty["id"],
    label: `p${i}`,
    ariaLabel: `property ${i}`,
    scope: "column-property",
    control: CONTROLS[i % 3],
    destructive: false,
    read: () => (CONTROLS[i % 3] === "stepper" ? 1 : null),
    commit: async () => {},
  }));
}

describe("ColumnInspector", () => {
  it("renders one row per descriptor with a byte-identical container class", () => {
    const a = render(
      <ColumnInspector properties={makeProperties(3)} ctx={ctx} title="Column 1" onClose={() => {}} />,
    );
    const aRoot = a.getByTestId("column-inspector");
    expect(aRoot.querySelectorAll("[data-property-row]")).toHaveLength(3);
    const cls = aRoot.className;
    a.unmount();

    const b = render(
      <ColumnInspector properties={makeProperties(6)} ctx={ctx} title="Column 1" onClose={() => {}} />,
    );
    const bRoot = b.getByTestId("column-inspector");
    expect(bRoot.querySelectorAll("[data-property-row]")).toHaveLength(6);
    expect(bRoot.className).toBe(cls);
  });

  it("contains no id-branching in its source", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "../ColumnInspector.tsx"), "utf-8");
    expect(source).not.toMatch(/\bid\s*===/);
    expect(source).not.toMatch(/switch\s*\(\s*[\w.]*\bid\s*\)/);
    expect(source).not.toMatch(/local\/editing/);
  });
});

describe("ColumnInspector layout (INV-015)", () => {
  it("3 vs 6 properties: identical row classes", () => {
    const a = render(
      <ColumnInspector properties={makeProperties(3)} ctx={ctx} title="Column 1" onClose={() => {}} />,
    );
    const aRows = [...a.getByTestId("column-inspector").querySelectorAll("[data-property-row]")];
    const rowCls = aRows[0].className;
    a.unmount();

    const b = render(
      <ColumnInspector properties={makeProperties(6)} ctx={ctx} title="Column 1" onClose={() => {}} />,
    );
    const bRows = [...b.getByTestId("column-inspector").querySelectorAll("[data-property-row]")];
    expect(bRows).toHaveLength(6);
    for (const r of bRows) expect(r.className).toBe(rowCls);
  });
});

describe("ColumnInspector text draft (INV-004 r4)", () => {
  let live = "";
  const textProperty = (commit: () => Promise<void>): ColumnProperty => ({
    id: "chord" as ColumnProperty["id"],
    label: "chord",
    ariaLabel: "chord symbol",
    scope: "column-property",
    control: "text",
    destructive: false,
    read: () => live,
    commit,
  });
  const view = (property: ColumnProperty) => (
    <ColumnInspector properties={[property]} ctx={ctx} title="Column 1" onClose={() => {}} />
  );

  it("holds the draft until read(ctx) changes, and keeps text typed in flight", async () => {
    live = "";
    let release = () => {};
    const property = textProperty(() => new Promise<void>((r) => (release = r)));
    const r = render(view(property));
    const input = r.getByLabelText("chord symbol") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Am" } });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });
    // Typed while the write is in flight.
    fireEvent.change(input, { target: { value: "Am7" } });
    await act(async () => release());
    // Commit resolved but the live row has not landed: the field still holds what was typed.
    expect(input.value).toBe("Am7");
    live = "Am";
    r.rerender(view(property));
    expect(input.value).toBe("Am7");
  });

  it("drops the draft once the live row shows it", async () => {
    live = "";
    const property = textProperty(async () => {});
    const r = render(view(property));
    const input = r.getByLabelText("chord symbol") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Am" } });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });
    expect(input.value).toBe("Am");
    live = "Am";
    r.rerender(view(property));
    expect(input.value).toBe("Am");
    live = "Dm";
    r.rerender(view(property));
    expect(input.value).toBe("Dm");
  });
});
