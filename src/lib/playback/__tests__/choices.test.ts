import { beforeEach, describe, expect, it } from "vitest";
import {
  PLAY_KEY, effective, getClick, getLoop, getNotes, getSpeed, setClick, setLoop, setNotes, setPlayStorage, setSpeed,
} from "../choices";

function spy() {
  const writes: [string, string][] = [];
  const data = new Map<string, string>();
  return {
    writes,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      writes.push([k, v]);
      data.set(k, v);
    },
  };
}

describe("INV-011 choices write at most the one key", () => {
  let store: ReturnType<typeof spy>;
  beforeEach(() => {
    store = spy();
    setPlayStorage(store);
  });

  it("setNotes writes only stablature.play", () => {
    setNotes(true);
    expect(store.writes.map(([k]) => k)).toEqual([PLAY_KEY]);
    expect(getNotes()).toBe(true);
  });
  it("click, loop and speed write nothing", () => {
    setClick(false);
    setLoop(true);
    setSpeed("a", 70);
    expect(store.writes).toEqual([]);
    expect(getClick()).toBe(false);
    expect(getLoop()).toBe(true);
  });
  it("anything unparseable reads as off and is left alone", () => {
    for (const raw of ["nope", "[]", "null", "{\"notes\":1}"]) {
      setPlayStorage({ getItem: () => raw, setItem: () => {} });
      expect(getNotes()).toBe(false);
    }
  });
  it("a refused write still changes the visit", () => {
    setPlayStorage({ getItem: () => null, setItem: () => { throw new Error("quota"); } });
    setNotes(true);
    expect(getNotes()).toBe(true);
  });
  it("speed is per song, clamped, stepped by 5, and reset on a fresh module", () => {
    expect(getSpeed("a")).toBe(100);
    setSpeed("a", 52);
    setSpeed("b", 10);
    expect(getSpeed("a")).toBe(50);
    expect(getSpeed("b")).toBe(50);
    setSpeed("a", 73);
    expect(getSpeed("a")).toBe(75);
    expect(getSpeed("c")).toBe(100);
    setPlayStorage(store);
    expect(getSpeed("a")).toBe(100);
  });
});

describe("INV-012 effective tempo", () => {
  it.each([50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100])("speed %i, Notes off or on, is bpm × speed / 100", (speed) => {
    expect(effective(160, speed)).toBe((160 * speed) / 100);
  });
});
