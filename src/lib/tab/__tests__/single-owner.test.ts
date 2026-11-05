import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { annotationRowSchema, eventRowSchema } from "../../sync/protocol";

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

describe("single owner of the import limits and glyphs (INV-026)", () => {
  const importer = ["src/lib/tab/reading.ts", "src/lib/tab/parse.ts"].filter(existsSync);

  it.each(importer)("%s takes limits from model.ts and glyphs from TRANSITIONS", (path) => {
    const text = read(path);
    expect(text).toMatch(/from\s+["'][^"']*\/model["']/);
    if (path.endsWith("parse.ts")) expect(text).toMatch(/TRANSITIONS/);
    expect(text).not.toMatch(/\b(36|512)\b/);
  });

  it("protocol.ts imports its caps and spells no literal for them", () => {
    const text = read("src/lib/sync/protocol.ts");
    for (const name of ["MAX_FRET", "MAX_REPEAT", "MAX_CHORD_LENGTH"]) {
      expect(text).toContain(name);
    }
    expect(text).not.toMatch(/\.max\((36|512|200)\)/);
  });

  const meta = { updatedAt: "000000000000000:0000:a", deletedAt: null, fieldClocks: {}, serverSeq: 0 };
  const uuid = "018f0000-0000-7000-8000-000000000000";
  const event = (frets: Record<string, number>, repeat = 1) => ({
    id: uuid,
    bandId: uuid,
    partId: uuid,
    rank: "a0",
    kind: "notes",
    frets,
    techniques: {},
    repeat,
    durationHint: null,
    tupletId: null,
    tupletCount: null,
    ...meta,
  });

  it("accepts and rejects exactly at the fret, repeat and chord caps", () => {
    expect(eventRowSchema.safeParse(event({ "0": 36 })).success).toBe(true);
    expect(eventRowSchema.safeParse(event({ "0": 37 })).success).toBe(false);
    expect(eventRowSchema.safeParse(event({ "0": 1 }, 512)).success).toBe(true);
    expect(eventRowSchema.safeParse(event({ "0": 1 }, 513)).success).toBe(false);

    const note = (value: string) => ({
      id: uuid,
      bandId: uuid,
      partId: uuid,
      anchorEventId: null,
      kind: "chord",
      value,
      ...meta,
    });
    expect(annotationRowSchema.safeParse(note("x".repeat(200))).success).toBe(true);
    expect(annotationRowSchema.safeParse(note("x".repeat(201))).success).toBe(false);
  });
});
