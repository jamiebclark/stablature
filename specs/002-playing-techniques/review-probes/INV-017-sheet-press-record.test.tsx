// @vitest-environment jsdom
/**
 * INV-017 (jsdom half), extended. The suite proves a stray click is dropped on a fresh Sheet.
 * The record of "a press began inside" lives in a ref on a Sheet that stays mounted across
 * opens and is cleared only by a click, so these exercise a press that ends WITHOUT a click:
 * a touch drag that scrolls the sheet (pointercancel), then a close that is not a click.
 */
import { createEvent, fireEvent, render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Sheet } from "@/components/ui";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

const click = (el: Element, detail: number) => fireEvent(el, createEvent.click(el, { detail }));

function sheet(open: boolean, onTap: () => void) {
  return (
    <Sheet open={open} onClose={() => {}} label="Column">
      <button type="button" onClick={onTap}>
        inner
      </button>
    </Sheet>
  );
}

describe("INV-017 the press record", () => {
  it("a cancelled press inside does not license the release that opens the sheet next time", () => {
    const onTap = vi.fn();
    const view = render(sheet(true, onTap));
    const first = view.getByText("inner");
    // A touch scroll of the sheet: pointerdown inside, then the browser takes the gesture.
    fireEvent.pointerDown(first);
    fireEvent.pointerCancel(first);
    // Closed by the system back gesture or Escape: no click, so nothing clears the record.
    view.rerender(sheet(false, onTap));
    view.rerender(sheet(true, onTap));
    // The release of the long press that re-opened it: a pointer click, no press inside.
    click(view.getByText("inner"), 1);
    expect(onTap).not.toHaveBeenCalled();
  });

  it("a cancelled press does not license a stray click in the same opening", () => {
    const onTap = vi.fn();
    const view = render(sheet(true, onTap));
    const button = view.getByText("inner");
    fireEvent.pointerDown(button);
    fireEvent.pointerCancel(button);
    click(button, 1);
    expect(onTap).not.toHaveBeenCalled();
  });

  it("a keyboard click still passes after a cancelled press", () => {
    const onTap = vi.fn();
    const view = render(sheet(true, onTap));
    const button = view.getByText("inner");
    fireEvent.pointerDown(button);
    fireEvent.pointerCancel(button);
    click(button, 0);
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});
