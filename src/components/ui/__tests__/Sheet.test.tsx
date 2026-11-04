// @vitest-environment jsdom
import { createEvent, fireEvent, render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Sheet } from "../index";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

function setup() {
  const onTap = vi.fn();
  const view = render(
    <Sheet open onClose={() => {}} label="Column">
      <button type="button" onClick={onTap}>
        inner
      </button>
    </Sheet>,
  );
  return { onTap, button: view.getByText("inner") };
}

function click(el: Element, detail: number) {
  const ev = createEvent.click(el, { detail });
  fireEvent(el, ev);
  return ev;
}

describe("Sheet stray clicks (INV-017)", () => {
  it("drops a pointer click with no press inside", () => {
    const { onTap, button } = setup();
    const ev = click(button, 1);
    expect(onTap).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(true);
  });

  it("passes a click whose press began inside, once", () => {
    const { onTap, button } = setup();
    fireEvent.pointerDown(button);
    click(button, 1);
    expect(onTap).toHaveBeenCalledTimes(1);
    click(button, 1);
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("always passes a keyboard click (detail 0)", () => {
    const { onTap, button } = setup();
    click(button, 0);
    click(button, 0);
    expect(onTap).toHaveBeenCalledTimes(2);
  });
});

function sheet(open: boolean, onTap: () => void) {
  return (
    <Sheet open={open} onClose={() => {}} label="Column">
      <button type="button" onClick={onTap}>
        inner
      </button>
    </Sheet>
  );
}

describe("Sheet press record (INV-017)", () => {
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
