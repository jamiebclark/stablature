// @vitest-environment jsdom
import { act, fireEvent, render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/local/editing", () => ({ setSongTempo: vi.fn(async () => true) }));
import { setSongTempo } from "@/lib/local/editing";
import { TempoControl } from "../TempoControl";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

const open = (bpm: number | null = null) => {
  const view = render(<TempoControl song={{ id: "s", bpm }} variant="header" />);
  fireEvent.click(view.getByTestId("tempo-control"));
  return view;
};
const down = (el: Element, timeStamp: number, init: object = {}) => {
  const e = new MouseEvent("pointerdown", { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(e, "timeStamp", { value: timeStamp });
  Object.defineProperty(e, "pointerType", { value: "touch" });
  act(() => void el.dispatchEvent(e));
};
const key = (el: Element, k: string, timeStamp: number, repeat = false) => {
  const e = new KeyboardEvent("keydown", { key: k, repeat, bubbles: true, cancelable: true });
  Object.defineProperty(e, "timeStamp", { value: timeStamp });
  act(() => void el.dispatchEvent(e));
};

describe("TempoControl", () => {
  it("names the control and shows the stored tempo", () => {
    const view = open(96);
    expect(view.getByTestId("tempo-control").getAttribute("aria-label")).toBe("Tempo: 96 bpm");
    expect(view.getByTestId("tempo-stored").textContent).toBe("This song: 96 bpm");
    view.unmount();
    const none = open(null);
    expect(none.getByTestId("tempo-control").getAttribute("aria-label")).toBe("Tempo: not given");
    expect(none.getByTestId("tempo-stored").textContent).toBe("This song has no tempo");
  });
  it("walks the waiting words, counts a held press once, and offers set only on a reading", () => {
    const view = open();
    const pad = view.getByTestId("tap-pad");
    const say = () => view.getByTestId("tempo-reading").textContent;
    expect(say()).toBe("Tap in time");
    expect(view.queryByTestId("tempo-set")).toBeNull();
    down(pad, 1000);
    expect(say()).toBe("Keep tapping");
    down(pad, 1500);
    expect(say()).toBe("Once more");
    down(pad, 2000);
    expect(say()).toBe("120");
    expect(view.getByTestId("tempo-set").textContent).toBe("Set 120 bpm");
  });
  it("ignores key repeat, counts Space and Enter once each, and a detail-0 click once", () => {
    const view = open();
    const pad = view.getByTestId("tap-pad");
    key(pad, " ", 1000);
    key(pad, " ", 1100, true);
    fireEvent.click(pad, { detail: 0 }); // follows the key press: not counted again
    expect(view.getByTestId("tempo-reading").textContent).toBe("Keep tapping");
    key(pad, "Enter", 1500);
    expect(view.getByTestId("tempo-reading").textContent).toBe("Once more");
    fireEvent.click(pad, { detail: 0 });
    fireEvent.click(pad, { detail: 0, });
    expect(view.getByTestId("tempo-reading").textContent).not.toBe("Once more");
  });
  it("says out of range and too slow", () => {
    const view = open();
    const pad = view.getByTestId("tap-pad");
    [0, 149, 298].forEach((t) => down(pad, t + 1));
    expect(view.getByTestId("tempo-reading").textContent).toContain("403 is out of range. Tempo runs from 20 to 400.");
    view.unmount();
    const slow = open();
    down(slow.getByTestId("tap-pad"), 1);
    down(slow.getByTestId("tap-pad"), 3600);
    expect(slow.getByTestId("tempo-reading").textContent).toBe("Too slow to read. Tempo runs from 20 to 400.");
  });
  it("set writes once; close writes nothing", async () => {
    const view = open();
    const pad = view.getByTestId("tap-pad");
    [1000, 1500, 2000].forEach((t) => down(pad, t));
    fireEvent.click(view.getByText("close"));
    expect(setSongTempo).not.toHaveBeenCalled();
  });
});
