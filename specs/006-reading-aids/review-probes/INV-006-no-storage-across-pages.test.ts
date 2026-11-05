/**
 * INV-006 round 2, at the store. **St** × {read, set, then read again}, with the step the round 1 probes never took:
 * the last listener leaving and a new one arriving, which is what an in-app link between the two pages does.
 *
 * T064 re-reads storage on the first subscribe unless the last write was refused, but `store()` returning null
 * (`localStorage` undefined, or its getter throwing) refuses nothing: `store()?.setItem` simply does not run.
 */
import { afterEach, describe, expect, it } from "vitest";
import { getStaffView, resetStaffViewForTest, setStaffView, subscribeStaffView } from "@/lib/reading/view";

const NONE = () => {};
const leaveAndComeBack = () => {
  const off = subscribeStaffView(NONE);
  setStaffView("notes");
  off();
  const back = subscribeStaffView(NONE);
  const seen = getStaffView();
  back();
  return seen;
};

afterEach(() => resetStaffViewForTest());

describe("INV-006 a choice lasts the visit, across pages", () => {
  it("no storage at all", () => {
    resetStaffViewForTest(null);
    expect(leaveAndComeBack()).toBe("notes");
  });
  it("setItem throws", () => {
    resetStaffViewForTest({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(leaveAndComeBack()).toBe("notes");
  });
  it("getItem throws", () => {
    resetStaffViewForTest({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: NONE,
    });
    expect(leaveAndComeBack()).toBe("notes");
  });
  it("normal storage", () => {
    const held = new Map<string, string>();
    resetStaffViewForTest({
      getItem: (key) => held.get(key) ?? null,
      setItem: (key, value) => void held.set(key, value),
    });
    expect(leaveAndComeBack()).toBe("notes");
  });
});
