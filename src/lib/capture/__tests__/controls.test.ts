import { describe, expect, it } from "vitest";
import type { EventRow } from "@/lib/model";
import type { CursorTarget } from "../target";
import { isPresent, TOOLBAR_CONTROLS } from "../controls";

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

describe("isPresent", () => {
  for (const control of TOOLBAR_CONTROLS) {
    for (const kind of Object.keys(targets) as CursorTarget["kind"][]) {
      const expected = control.group === "stable" || kind === "playable";
      it(`${control.id} (${control.group}) × ${kind} = ${expected}`, () => {
        expect(isPresent(control, targets[kind])).toBe(expected);
      });
    }
  }
});

describe("TOOLBAR_CONTROLS", () => {
  it("declares the five stable controls before the four contextual ones, in DOM order", () => {
    expect(TOOLBAR_CONTROLS.map((c) => c.id)).toEqual([
      "space",
      "barline",
      "select",
      "paste",
      "delete",
      "triplet",
      "repeat",
      "times4",
      "chord",
    ]);
  });
});
