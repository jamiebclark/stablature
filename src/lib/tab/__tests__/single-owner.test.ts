import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("single drawing owner (INV-005)", () => {
  it.each(["src/lib/tab/ascii.ts", "src/components/tab/TabStaff.tsx"])(
    "%s neither imports techniques.ts nor reads .techniques",
    (path) => {
      const text = read(path);
      expect(text).not.toMatch(/from\s+["'][^"']*techniques["']/);
      expect(text).not.toMatch(/\.techniques\b/);
    },
  );
});

describe("no literal ids in the capture UI (INV-025)", () => {
  it.each(["src/components/capture/LatchStrip.tsx", "src/components/capture/ColumnInspector.tsx"])(
    "%s names no latch or property id",
    (path) => {
      const text = read(path);
      for (const id of ["stack", "hammer_on", "pull_off", "slide_up", "slide_down", "decorations"]) {
        expect(text, id).not.toContain(`"${id}"`);
      }
    },
  );

  it("CaptureScreen does not test a latch id by literal", () => {
    const text = read("src/components/capture/CaptureScreen.tsx");
    expect(text).not.toContain('lit.has("stack")');
  });
});
