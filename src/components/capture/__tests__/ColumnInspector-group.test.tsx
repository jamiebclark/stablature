// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { COLUMN_PROPERTIES, propertiesFor, type PropertyContext } from "@/lib/capture/properties";
import type { EventRow } from "@/lib/model";
import { ColumnInspector } from "../ColumnInspector";

function column(over: Partial<EventRow>): EventRow {
  return {
    id: "e1",
    partId: "p1",
    kind: "note",
    repeat: 1,
    frets: { "0": 3 },
    techniques: {},
    tupletId: null,
    tupletCount: null,
    groupKind: null,
    ...over,
  } as unknown as EventRow;
}

const ctxFor = (event: EventRow) =>
  ({ part: { id: "p1", bandId: "b1" }, event, annotations: [], tuning: { strings: [{ note: "E" }] } }) as unknown as PropertyContext;

function headings(event: EventRow): string[] {
  const group = COLUMN_PROPERTIES.find((p) => p.id === "group")!;
  const ctx = ctxFor(event);
  if (!(group.appliesToColumn?.(event) ?? true)) return [];
  const view = render(
    <ColumnInspector properties={[group]} ctx={ctx} title="Column" onClose={() => {}} />,
  );
  const rows = [...view.container.querySelectorAll("[data-property-row] > span")].map(
    (n) => n.textContent ?? "",
  );
  view.unmount();
  return rows;
}

describe("INV-018: the group row", () => {
  it.each([
    [{ tupletId: "g", tupletCount: 2, groupKind: "tuplet" }, "tuplet of 2"],
    [{ tupletId: "g", tupletCount: 5, groupKind: "tuplet" }, "tuplet of 5"],
    [{ tupletId: "g", tupletCount: 16, groupKind: "tuplet" }, "tuplet of 16"],
    [{ tupletId: "g", tupletCount: null, groupKind: "plain" }, "plain group"],
    [{ tupletId: "g", tupletCount: null, groupKind: undefined }, "tuplet of 3"],
  ] as const)("%j reads %s", (over, text) => {
    expect(headings(column(over as Partial<EventRow>))).toEqual([text]);
  });

  it("has no row for an ungrouped column or a barline", () => {
    expect(headings(column({}))).toEqual([]);
    const target = { event: column({ kind: "barline" as EventRow["kind"] }) };
    expect(propertiesFor(target as never).map((p) => p.id)).not.toContain("group");
  });

  it("shows for a rest in a group and a column inside a repeat", () => {
    const g = { tupletId: "g", tupletCount: 3, groupKind: "tuplet" } as const;
    expect(headings(column({ ...g, frets: {} }))).toEqual(["tuplet of 3"]);
    expect(headings(column({ ...g, repeat: 3 }))).toEqual(["tuplet of 3"]);
  });
});
