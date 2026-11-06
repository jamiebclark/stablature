// @vitest-environment jsdom
/** The panel store never throws, never trusts what it reads, keeps unknown keys, and a refused write still changes the screen. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPanelOpen, PANEL_IDS, PANELS_KEY, setPanelOpen, setPanelStorage, subscribePanels } from "../panels";

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

beforeEach(() => setPanelStorage(null));

describe("panels", () => {
  it("reads closed when storage is missing", () => {
    for (const id of PANEL_IDS) expect(getPanelOpen(id)).toBe(false);
  });

  it("reads closed for storage that throws, is empty, or holds junk", () => {
    const throwing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    for (const store of [throwing, memory(), memory({ [PANELS_KEY]: "[]" }), memory({ [PANELS_KEY]: "nope" })]) {
      setPanelStorage(store);
      for (const id of PANEL_IDS) expect(getPanelOpen(id)).toBe(false);
      expect(() => setPanelOpen("song-tools", false)).not.toThrow();
    }
  });

  it("remembers each panel on its own and keeps keys it does not know", () => {
    const store = memory({ [PANELS_KEY]: JSON.stringify({ "future-panel": true, "song-tools": true }) });
    setPanelStorage(store);
    expect(getPanelOpen("song-tools")).toBe(true);
    expect(getPanelOpen("song-arrange")).toBe(false);
    setPanelOpen("song-arrange", true);
    setPanelOpen("song-tools", false);
    expect(JSON.parse(store.data.get(PANELS_KEY)!)).toEqual({
      "future-panel": true,
      "song-tools": false,
      "song-arrange": true,
    });
  });

  it("a refused write still changes the screen for the visit", () => {
    setPanelStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    setPanelOpen("play-cluster", true);
    expect(getPanelOpen("play-cluster")).toBe(true);
  });

  it("with no storage at all a set still holds", () => {
    setPanelOpen("play-cluster", true);
    expect(getPanelOpen("play-cluster")).toBe(true);
  });

  it("notifies subscribers, and a second tab's write replaces the visit's choice", () => {
    const store = memory();
    setPanelStorage(store);
    const listener = vi.fn();
    const off = subscribePanels(listener);
    setPanelOpen("song-tools", true);
    expect(listener).toHaveBeenCalledTimes(1);
    store.data.set(PANELS_KEY, JSON.stringify({ "song-tools": false }));
    window.dispatchEvent(new StorageEvent("storage", { key: PANELS_KEY }));
    expect(getPanelOpen("song-tools")).toBe(false);
    off();
  });
});
