// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { COLUMN_PROPERTIES, type PropertyContext } from "@/lib/capture/properties";
import { TOOLBAR_CONTROLS } from "@/lib/capture/controls";
import { DURATIONS, nextDuration } from "@/lib/rhythm/durations";
import { ColumnInspector } from "../ColumnInspector";

const property = COLUMN_PROPERTIES.find((p) => p.id === "duration")!;
const ctxFor = (durationHint: unknown) =>
  ({ part: { id: "p", bandId: "b" }, event: { id: "e1", durationHint }, annotations: [] }) as unknown as PropertyContext;

function lit(view: ReturnType<typeof render>): string[] {
  return Array.from(view.getByTestId("duration-row").querySelectorAll("button"))
    .filter((b) => b.getAttribute("aria-pressed") === "true")
    .map((b) => b.getAttribute("data-duration") ?? "");
}

describe("duration row", () => {
  it("lights exactly the stored value after every (stored, tap) pair", () => {
    for (const stored of [null, ...DURATIONS.map((d) => d.id)]) {
      for (const tapped of DURATIONS) {
        let current: string | null = stored;
        const commit = vi.fn(async (_c: PropertyContext, v: unknown) => {
          current = nextDuration(current, v as never);
        });
        const p = { ...property, commit };
        const view = render(
          <ColumnInspector properties={[p]} ctx={ctxFor(current)} title="Column 1" onClose={() => {}} />,
        );
        fireEvent.click(view.getByLabelText(tapped.words));
        view.rerender(
          <ColumnInspector properties={[p]} ctx={ctxFor(current)} title="Column 1" onClose={() => {}} />,
        );
        expect(lit(view)).toEqual(current === null ? [] : [current]);
        view.unmount();
      }
    }
  });
  it("two taps in one tick both reach commit", () => {
    const commit = vi.fn(async () => {});
    const view = render(
      <ColumnInspector properties={[{ ...property, commit }]} ctx={ctxFor(null)} title="C" onClose={() => {}} />,
    );
    fireEvent.click(view.getByLabelText("half note"));
    fireEvent.click(view.getByLabelText("quarter note"));
    expect(commit).toHaveBeenCalledTimes(2);
  });
  it("sets aria-pressed per position and lights nothing for an unknown value", () => {
    const view = render(<ColumnInspector properties={[property]} ctx={ctxFor("q")} title="C" onClose={() => {}} />);
    expect(view.getByLabelText("quarter note").getAttribute("aria-pressed")).toBe("true");
    expect(view.getByLabelText("half note").getAttribute("aria-pressed")).toBe("false");
    view.unmount();
    for (const u of ["64", "", "Q", 7, true, undefined]) {
      const v = render(<ColumnInspector properties={[property]} ctx={ctxFor(u)} title="C" onClose={() => {}} />);
      expect(lit(v)).toEqual([]);
      v.unmount();
    }
  });
  it("draws symbols in order, named in words, with no letters", () => {
    const view = render(<ColumnInspector properties={[property]} ctx={ctxFor("q")} title="C" onClose={() => {}} />);
    const buttons = Array.from(view.getByTestId("duration-row").querySelectorAll("button"));
    expect(buttons.map((b) => b.getAttribute("data-duration"))).toEqual(DURATIONS.map((d) => d.id));
    buttons.forEach((b, i) => {
      expect(b.getAttribute("aria-label")).toBe(DURATIONS[i].words);
      expect(b.getAttribute("title")).toBe(DURATIONS[i].words);
      expect(b.textContent).toBe("");
      expect(b.querySelector("svg[data-part=note-symbol]")).not.toBeNull();
    });
  });
  it("is not a toolbar control", () => {
    expect(JSON.stringify(TOOLBAR_CONTROLS)).not.toContain("duration");
  });
});
