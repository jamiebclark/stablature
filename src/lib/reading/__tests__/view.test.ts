// @vitest-environment jsdom
/** INV-006: the view store never throws, never trusts what it reads, and a refused write still changes the screen. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getStaffView,
  readStaffView,
  resetStaffViewForTest,
  setStaffView,
  STAFF_VIEW_KEY,
  STAFF_VIEWS,
  subscribeStaffView,
} from "../view";

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

beforeEach(() => resetStaffViewForTest(null));

describe("readStaffView", () => {
  it("accepts only the three views", () => {
    for (const v of STAFF_VIEWS) expect(readStaffView(v)).toBe(v);
    for (const bad of ["tabs", "", "NOTES", null, undefined, 3, {}]) expect(readStaffView(bad)).toBe("frets");
  });
});

describe("the store over storage states", () => {
  it("reads frets when nothing is stored, then what was set", () => {
    const s = memory();
    resetStaffViewForTest(s);
    expect(getStaffView()).toBe("frets");
    setStaffView("notes");
    expect(getStaffView()).toBe("notes");
    expect(s.data.get(STAFF_VIEW_KEY)).toBe("notes");
  });

  it("reads a stored valid view", () => {
    resetStaffViewForTest(memory({ [STAFF_VIEW_KEY]: "intervals" }));
    expect(getStaffView()).toBe("intervals");
  });

  it.each(["tabs", "", "NOTES"])("reads %j as frets and leaves it in place", (raw) => {
    const s = memory({ [STAFF_VIEW_KEY]: raw });
    resetStaffViewForTest(s);
    expect(getStaffView()).toBe("frets");
    expect(getStaffView()).toBe("frets");
    expect(s.data.get(STAFF_VIEW_KEY)).toBe(raw);
  });

  it("works with no storage at all", () => {
    resetStaffViewForTest(null);
    expect(getStaffView()).toBe("frets");
    setStaffView("intervals");
    expect(getStaffView()).toBe("intervals");
  });

  it("survives a getItem that throws", () => {
    resetStaffViewForTest({
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {},
    });
    expect(getStaffView()).toBe("frets");
    expect(() => setStaffView("notes")).not.toThrow();
    expect(getStaffView()).toBe("notes");
  });

  it("a refused write still changes the screen", () => {
    resetStaffViewForTest({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(() => setStaffView("notes")).not.toThrow();
    expect(getStaffView()).toBe("notes");
  });

  it("notifies subscribers on a set, and not after unsubscribe", () => {
    const fn = vi.fn();
    const off = subscribeStaffView(fn);
    setStaffView("notes");
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    setStaffView("intervals");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("follows a change made in a second tab, and ignores junk or other keys", () => {
    resetStaffViewForTest(memory());
    const fn = vi.fn();
    const off = subscribeStaffView(fn);
    window.dispatchEvent(new StorageEvent("storage", { key: STAFF_VIEW_KEY, newValue: "intervals" }));
    expect(getStaffView()).toBe("intervals");
    window.dispatchEvent(new StorageEvent("storage", { key: STAFF_VIEW_KEY, newValue: "tabs" }));
    expect(getStaffView()).toBe("frets");
    window.dispatchEvent(new StorageEvent("storage", { key: "other", newValue: "notes" }));
    expect(getStaffView()).toBe("frets");
    off();
  });
});

describe("a tab that was not listening (review F5)", () => {
  it("re-reads storage when the first listener subscribes", () => {
    const storage = memory();
    resetStaffViewForTest(storage);
    setStaffView("notes");
    // Another tab chose while nothing here was subscribed, so no storage event reached us.
    storage.data.set(STAFF_VIEW_KEY, "intervals");
    const off = subscribeStaffView(() => {});
    expect(getStaffView()).toBe("intervals");
    off();
  });

  it("reads a key another tab cleared as frets", () => {
    const storage = memory();
    resetStaffViewForTest(storage);
    setStaffView("notes");
    storage.data.delete(STAFF_VIEW_KEY);
    const off = subscribeStaffView(() => {});
    expect(getStaffView()).toBe("frets");
    off();
  });

  it("treats a storage event with a null key (storage.clear) as this key cleared", () => {
    resetStaffViewForTest(memory());
    const fn = vi.fn();
    const off = subscribeStaffView(fn);
    setStaffView("notes");
    window.dispatchEvent(new StorageEvent("storage", { key: null, newValue: null }));
    expect(getStaffView()).toBe("frets");
    expect(fn).toHaveBeenCalled();
    off();
  });

  it("still lets a refused write change the screen after a subscribe", () => {
    const refusing = { getItem: () => null, setItem: () => { throw new Error("full"); } };
    resetStaffViewForTest(refusing);
    setStaffView("notes");
    const off = subscribeStaffView(() => {});
    expect(getStaffView()).toBe("notes");
    off();
  });
});

describe("INV-006 a choice lasts the visit, across pages", () => {
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
    const held = memory();
    resetStaffViewForTest(held);
    expect(leaveAndComeBack()).toBe("notes");
  });
});
