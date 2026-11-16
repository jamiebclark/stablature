import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..", "..", "..");
const playback = join(root, "src", "lib", "playback");
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? (d.name === "__tests__" ? [] : files(join(dir, d.name))) : [join(dir, d.name)],
  );
const watched = [
  ...files(playback),
  join(root, "src", "lib", "rhythm", "scheduler.ts"),
  join(root, "src", "lib", "rhythm", "audio.ts"),
  join(root, "src", "components", "rhythm", "ClickBar.tsx"),
  join(root, "src", "components", "rhythm", "useClick.ts"),
];

describe("INV-016 no dynamic import in playback", () => {
  it("the playback directory is not empty", () => expect(files(playback).length).toBeGreaterThan(0));
  it.each(watched.map((f) => [f.slice(root.length + 1), f]))("%s has no import(", (_n, f) => {
    expect(readFileSync(f, "utf8")).not.toMatch(/\bimport\s*\(/);
  });
  it("INV-011: nothing in playback imports the data layers", () => {
    for (const f of files(playback)) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/^import .*["'](@\/lib\/(local|sync|server)|dexie)/m);
    }
  });
});
