// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { acceptsShortcut, screenFor, shortcutFor, SHORTCUTS, type KeyEventLike } from "../shortcuts";

const ev = (over: Partial<KeyEventLike> = {}): KeyEventLike => ({
  key: "r", target: document.body, ctrlKey: false, metaKey: false, altKey: false, ...over,
});

describe("shortcuts", () => {
  it("has the FR-057 rows and nothing else", () => {
    expect(SHORTCUTS.map((s) => s.id).sort()).toEqual(
      ["bar-back", "bar-on", "column-back", "column-on", "dead-note", "end", "enter", "help", "part-back", "part-on", "restart", "start", "string-down", "string-up", "toggle-click"].sort(),
    );
    expect(SHORTCUTS.flatMap((s) => s.keys)).not.toContain("Escape");
  });
  it("finds a key only on its screens", () => {
    expect(shortcutFor(" ", "play")?.id).toBe("toggle-click");
    expect(shortcutFor(" ", "capture")).toBeNull();
    expect(shortcutFor("5", "capture")?.id).toBe("enter");
    expect(shortcutFor("?", "other")?.id).toBe("help");
    expect(shortcutFor("r", "other")).toBeNull();
  });
  it("maps paths to screens", () => {
    expect(screenFor("/songs/a/play")).toBe("play");
    expect(screenFor("/songs/a/capture/b")).toBe("capture");
    expect(screenFor("/songs/a")).toBe("other");
  });
  it("rests for editable focus, modifiers, composition, sheets, own keys, repeats", () => {
    document.body.innerHTML = `<input id=i><button id=b></button><a id=a href="#"></a>`;
    const at = (id: string) => document.getElementById(id);
    expect(acceptsShortcut(ev(), document)).toBe(true);
    expect(acceptsShortcut(ev({ key: "?" }), document)).toBe(true);
    expect(acceptsShortcut(ev({ target: at("i") }), document)).toBe(false);
    expect(acceptsShortcut(ev({ ctrlKey: true }), document)).toBe(false);
    expect(acceptsShortcut(ev({ metaKey: true }), document)).toBe(false);
    expect(acceptsShortcut(ev({ altKey: true }), document)).toBe(false);
    expect(acceptsShortcut(ev({ isComposing: true }), document)).toBe(false);
    expect(acceptsShortcut(ev({ keyCode: 229 }), document)).toBe(false);
    expect(acceptsShortcut(ev({ key: " ", target: at("b") }), document)).toBe(false);
    expect(acceptsShortcut(ev({ key: "Enter", target: at("a") }), document)).toBe(false);
    expect(acceptsShortcut(ev({ key: "ArrowLeft", target: at("b") }), document)).toBe(true);
    expect(acceptsShortcut(ev({ key: "5", repeat: true }), document)).toBe(false);
    expect(acceptsShortcut(ev({ key: "ArrowLeft", repeat: true }), document)).toBe(true);
    document.body.innerHTML = `<dialog open></dialog>`;
    expect(acceptsShortcut(ev(), document)).toBe(false);
  });
});
