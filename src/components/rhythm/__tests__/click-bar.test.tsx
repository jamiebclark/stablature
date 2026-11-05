// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/local/editing", () => ({ setSongTempo: vi.fn(async () => true) }));
vi.mock("@/lib/rhythm/notation", async (orig) => {
  const mod = await orig<typeof import("@/lib/rhythm/notation")>();
  return { ...mod, readNotation: vi.fn(() => mod.EMPTY_SCORE) };
});
import * as notation from "@/lib/rhythm/notation";
import { ClickBar } from "../ClickBar";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  // jsdom has no Web Audio: the engine falls back to a silent clock.
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(cleanup);

const timed = { clicks: [{ tick: 0, level: "accent" as const }], lengthTicks: 360360, timedFromStart: true };
const bar = (bpm: number | null, ready = true, timedScore = false) => {
  vi.mocked(notation.readNotation).mockReturnValue(timedScore ? timed : notation.EMPTY_SCORE);
  return render(<ClickBar song={{ id: "s", bpm }} passes={[]} notationReady={ready} />);
};
const text = (v: ReturnType<typeof bar>, id: string) => v.getByTestId(id).textContent;

describe("ClickBar", () => {
  it("says to set a tempo and disables start without one", () => {
    const v = bar(null);
    expect(text(v, "click-state")).toBe("Set a tempo to use the click.");
    expect((v.getByTestId("click-start") as HTMLButtonElement).disabled).toBe(true);
    expect(v.queryByTestId("click-help")).toBeNull();
  });

  it("disables start until the notation has loaded", () => {
    const v = bar(120, false);
    expect((v.getByTestId("click-start") as HTMLButtonElement).disabled).toBe(true);
  });

  it("hides follow when the notation is not timed from the start", () => {
    const v = bar(120);
    expect(v.queryByTestId("click-follow")).toBeNull();
    expect(text(v, "click-state")).toBe("Click is a plain beat.");
  });

  it("offers follow when timed, and says what it will do", () => {
    const v = bar(120, true, true);
    expect(text(v, "click-state")).toBe("Click follows the notation.");
    const follow = v.getByTestId("click-follow");
    expect(follow.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(follow);
    expect(follow.getAttribute("aria-pressed")).toBe("false");
    expect(text(v, "click-state")).toBe("Click is a plain beat.");
  });

  it("swaps start for an inert beat and a focused stop, with help, and back", async () => {
    const v = bar(120);
    await act(async () => void fireEvent.click(v.getByTestId("click-start")));
    expect(v.queryByTestId("click-start")).toBeNull();
    expect(v.getByTestId("click-beat").getAttribute("aria-hidden")).toBe("true");
    expect(text(v, "click-state")).toBe("Counting in.");
    expect(text(v, "click-help")).toBe("No sound on this device. The beat is still shown.");
    expect(document.activeElement).toBe(v.getByTestId("click-stop"));
    act(() => void fireEvent.click(v.getByTestId("click-stop")));
    expect(v.getByTestId("click-start")).toBeTruthy();
    expect(text(v, "click-state")).toBe("Click is a plain beat.");
    expect(v.queryByTestId("click-help")).toBeNull();
  });

  it("leaves a line when the screen is hidden, until the next start", async () => {
    const v = bar(120);
    await act(async () => void fireEvent.click(v.getByTestId("click-start")));
    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    hidden.mockRestore();
    expect(text(v, "click-state")).toBe(
      "Stopped because the screen was hidden. Start again when you are ready.",
    );
    await act(async () => void fireEvent.click(v.getByTestId("click-start")));
    expect(text(v, "click-state")).toBe("Counting in.");
  });

  it("keeps the tempo control as one node across start", async () => {
    const v = bar(120);
    const before = v.getByTestId("tempo-control");
    await act(async () => void fireEvent.click(v.getByTestId("click-start")));
    expect(v.getByTestId("tempo-control")).toBe(before);
    expect(before.textContent).toBe("120 bpm");
  });
});
