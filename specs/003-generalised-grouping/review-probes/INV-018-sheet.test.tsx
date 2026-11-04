// @vitest-environment jsdom
/**
 * INV-018 / FR-026 / FR-027: the row through the real gate, propertiesFor(resolveTarget(...)) as
 * InspectorSheet calls it (CaptureScreen.tsx), over rows from real writes, rendered by the real
 * ColumnInspector. The suite's own test calls `appliesToColumn` on a fabricated row instead.
 */
import "fake-indexeddb/auto";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ColumnInspector } from "@/components/capture/ColumnInspector";
import { propertiesFor, type PropertyContext } from "@/lib/capture/properties";
import { resolveTarget } from "@/lib/capture/target";
import { groupSelection, setColumnRepeat } from "@/lib/local/editing";
import { newId } from "@/lib/ids";
import type { EventRow } from "@/lib/model";
import { bass5, build, makeLegacy, rows, world, type World } from "./unit-helpers";

function sheetRows(w: World, event: EventRow) {
  const properties = propertiesFor(resolveTarget(w.part, [event], event.id));
  const ctx = { part: w.part, event, annotations: [], tuning: bass5 } as unknown as PropertyContext;
  const view = render(
    <ColumnInspector properties={properties} ctx={ctx} title="Column" onClose={() => {}} />,
  );
  const labels = [...view.container.querySelectorAll("[data-property-row] > span")].map(
    (n) => n.textContent,
  );
  view.unmount();
  return { ids: properties.map((p) => p.id), labels };
}

describe("INV-018", () => {
  for (const n of [2, 5, 16]) {
    it(`a tuplet of ${n}, every column`, async () => {
      const w = await world();
      const all = await build(w, "n".repeat(n));
      await groupSelection(w.part.id, all[0].id, all.at(-1)!.id, "tuplet", w.ctx);
      for (const r of await rows(w)) expect(sheetRows(w, r).labels).toContain(`tuplet of ${n}`);
    });
  }
  it("plain, every column", async () => {
    const w = await world();
    const all = await build(w, "nnnn");
    await groupSelection(w.part.id, all[0].id, all[3].id, "plain", w.ctx);
    for (const r of await rows(w)) expect(sheetRows(w, r).labels).toContain("plain group");
  });
  it("legacy, and legacy with a null count", async () => {
    const w = await world();
    const all = await build(w, "nnnnn");
    const a = await makeLegacy(w, all[0].id, newId(), 5);
    const b = await makeLegacy(w, all[1].id, newId(), null);
    expect(sheetRows(w, a).labels).toContain("tuplet of 5");
    expect(sheetRows(w, b).labels).toContain("tuplet of 3");
  });
  it("no group, and a barline", async () => {
    const w = await world();
    const all = await build(w, "n|n");
    expect(sheetRows(w, all[0]).ids).not.toContain("group");
    expect(sheetRows(w, all[1]).ids).not.toContain("group");
  });
  it("a rest in a group, and a column inside a repeat", async () => {
    const w = await world();
    const all = await build(w, "nrn");
    await setColumnRepeat(all[2].id, 3, w.ctx);
    await groupSelection(w.part.id, all[0].id, all[2].id, "tuplet", w.ctx);
    const after = await rows(w);
    expect(sheetRows(w, after[1]).labels).toContain("tuplet of 3");
    expect(sheetRows(w, after[2]).labels).toContain("tuplet of 3");
  });
  it("the row sits just before delete", async () => {
    const w = await world();
    const all = await build(w, "nn");
    await groupSelection(w.part.id, all[0].id, all[1].id, "plain", w.ctx);
    const { ids } = sheetRows(w, (await rows(w))[0]);
    expect(ids.indexOf("group")).toBe(ids.indexOf("delete") - 1);
  });
});
