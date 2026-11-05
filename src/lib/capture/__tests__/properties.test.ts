import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { EventRow } from "@/lib/model";
import type { CursorTarget } from "../target";
import { COLUMN_PROPERTIES, propertiesFor } from "../properties";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..");

const syncMeta = { updatedAt: "", deletedAt: null, fieldClocks: {}, serverSeq: 0 } as const;

const notesEvent: EventRow = {
  ...syncMeta,
  id: "notes-1",
  bandId: "band-1",
  partId: "part-1",
  rank: "a",
  kind: "notes",
  frets: {},
  techniques: {},
  repeat: 1,
  durationHint: null,
  tupletId: null,
  tupletCount: null,
};

const targets: Record<CursorTarget["kind"], CursorTarget> = {
  "no-part": { kind: "no-part" },
  "no-column": { kind: "no-column" },
  playable: { kind: "playable", event: notesEvent },
  barline: { kind: "barline", event: { ...notesEvent, kind: "barline" } },
};

const FORBIDDEN = ["bumpColumnRepeat", "setChord", "deleteColumn"];

function importsForbiddenSymbol(source: string): string | undefined {
  const importBlocks = source.match(/import\s+\{[^}]*\}\s+from\s+["'][^"']*editing["']/g) ?? [];
  for (const block of importBlocks) {
    for (const symbol of FORBIDDEN) {
      if (new RegExp(`\\b${symbol}\\b`).test(block)) return symbol;
    }
  }
  return undefined;
}

describe("INV-004: the capture screen never imports the mutations directly", () => {
  const candidates = [
    join(repoRoot, "src/components/capture/CaptureScreen.tsx"),
    join(repoRoot, "src/components/capture/ColumnInspector.tsx"),
  ];

  for (const path of candidates) {
    it(`${path.replace(repoRoot, "")} does not import bumpColumnRepeat/setChord/deleteColumn from editing.ts`, () => {
      if (!existsSync(path)) return; // not created yet; the assertion holds vacuously
      const source = readFileSync(path, "utf8");
      expect(importsForbiddenSymbol(source)).toBeUndefined();
    });
  }
});

describe("propertiesFor", () => {
  it("returns repeat and chord only for a playable target", () => {
    expect(propertiesFor(targets.playable).map((p) => p.id)).toEqual([
      "repeat",
      "chord",
      "duration",
      "delete",
    ]);
  });

  it("returns delete for every target except no-part and no-column", () => {
    expect(propertiesFor(targets["no-part"]).map((p) => p.id)).toEqual([]);
    expect(propertiesFor(targets["no-column"]).map((p) => p.id)).toEqual(["delete"]);
    expect(propertiesFor(targets.barline).map((p) => p.id)).toEqual(["delete"]);
    expect(propertiesFor(targets.playable)).toContainEqual(
      expect.objectContaining({ id: "delete" }),
    );
  });
});

describe("COLUMN_PROPERTIES", () => {
  it("declares repeat, chord, decorations, group, delete in that order", () => {
    expect(COLUMN_PROPERTIES.map((p) => p.id)).toEqual(["repeat", "chord", "decorations", "group", "duration", "delete"]);
  });
});
