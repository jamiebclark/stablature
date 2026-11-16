// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/local/editing", () => ({ setSongTempo: vi.fn(async () => true) }));
import { setPlayStorage, setNotes } from "@/lib/playback/choices";
import { passesOf } from "@/lib/playback/__tests__/fixtures";
import { playRounds } from "@/lib/playback/stream";
import { TUNING_PRESETS } from "@/lib/tunings";
import { ClickBar, CLICK_WORDS } from "../ClickBar";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => {
  cleanup();
  setPlayStorage(null);
});

const tuning = TUNING_PRESETS[0];
const WRITTEN = passesOf(["3:5@q 3:5@q"]);
const SOME = passesOf(["3:5@8 3:5"]);
const NONE = passesOf(["3:5 3:7"]);
const EMPTY = passesOf(["| |"]);

const bar = (passes: ReturnType<typeof passesOf>, o: { bpm?: number | null; tuned?: boolean } = {}) => {
  act(() => setNotes(true));
  return render(
    <ClickBar
      song={{ id: "s", bpm: o.bpm === undefined ? 100 : o.bpm }}
      passes={passes}
      notationReady
      playback={{ scope: "song", tuning: o.tuned === false ? null : tuning }}
    />,
  );
};
const state = (v: ReturnType<typeof bar>) => v.getByTestId("click-state").textContent;
const start = (v: ReturnType<typeof bar>) => (v.getByTestId("click-start") as HTMLButtonElement).disabled;

describe("ClickBar with Notes on: idle words equal the timeline rule", () => {
  it("no tempo", () => {
    const v = bar(WRITTEN, { bpm: null });
    expect(state(v)).toBe(CLICK_WORDS.noTempo);
    expect(start(v)).toBe(true);
  });
  it("no tuning", () => {
    const v = bar(WRITTEN, { tuned: false });
    expect(state(v)).toBe(CLICK_WORDS.notes.noTuning);
    expect(start(v)).toBe(true);
  });
  it.each([
    ["written", WRITTEN],
    ["some", SOME],
    ["none", NONE],
    ["empty", EMPTY],
  ] as const)("%s", (rule, passes) => {
    expect(playRounds(passes, tuning)?.first.rule).toBe(rule);
    const v = bar(passes);
    expect(state(v)).toBe(CLICK_WORDS.notes[rule]);
    // Play is disabled exactly when there is nothing to play.
    expect(start(v)).toBe(rule === "empty");
  });
});
