import { describe, expect, it } from "vitest";
import type { EventRow } from "@/lib/model";
import type { CursorTarget } from "../target";
import { appliesTo } from "../target";
import { litLatches } from "../latches";

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

describe("litLatches", () => {
  const armed = new Set<"stack">(["stack"]);

  for (const kind of Object.keys(targets) as CursorTarget["kind"][]) {
    it(`is a subset of armed and only contains applicable latches for ${kind}`, () => {
      const lit = litLatches(armed, targets[kind]);
      for (const id of lit) {
        expect(armed.has(id)).toBe(true);
        expect(appliesTo("next-note", targets[kind])).toBe(true);
      }
      expect(lit.size).toBe(kind === "playable" ? 1 : 0);
    });
  }

  it("never lights an unarmed latch", () => {
    expect(litLatches(new Set(), targets.playable).size).toBe(0);
  });
});
