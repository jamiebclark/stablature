import { describe, expect, it } from "vitest";
import type { EventRow, PartRow } from "@/lib/model";
import { appliesTo, resolveTarget, targetEvent, type CursorTarget, type Scope } from "../target";

const syncMeta = { updatedAt: "", deletedAt: null, fieldClocks: {}, serverSeq: 0 } as const;

const part: Pick<PartRow, "id"> = { id: "part-1" };

function event(id: string, kind: EventRow["kind"]): EventRow {
  return {
    ...syncMeta,
    id,
    bandId: "band-1",
    partId: part.id,
    rank: id,
    kind,
    frets: {},
    techniques: {},
    repeat: 1,
    durationHint: null,
    tupletId: null,
    tupletCount: null,
  };
}

const notesEvent = event("notes-1", "notes");
const restEvent = event("rest-1", "rest");
const barlineEvent = event("barline-1", "barline");
const columns = [notesEvent, restEvent, barlineEvent];

describe("resolveTarget", () => {
  it("resolves to no-part when there is no part", () => {
    expect(resolveTarget(null, columns, null)).toEqual({ kind: "no-part" });
  });

  it("resolves to no-column when afterId is null (cursor at start, or empty part)", () => {
    expect(resolveTarget(part, columns, null)).toEqual({ kind: "no-column" });
    expect(resolveTarget(part, [], null)).toEqual({ kind: "no-column" });
  });

  it("resolves to no-column when afterId names nothing (deleted elsewhere)", () => {
    expect(resolveTarget(part, columns, "gone")).toEqual({ kind: "no-column" });
  });

  it("resolves to playable for a notes column", () => {
    expect(resolveTarget(part, columns, notesEvent.id)).toEqual({
      kind: "playable",
      event: notesEvent,
    });
  });

  it("resolves to playable for a rest column", () => {
    expect(resolveTarget(part, columns, restEvent.id)).toEqual({
      kind: "playable",
      event: restEvent,
    });
  });

  it("resolves to barline for a barline column", () => {
    expect(resolveTarget(part, columns, barlineEvent.id)).toEqual({
      kind: "barline",
      event: barlineEvent,
    });
  });
});

describe("appliesTo", () => {
  const targets: Record<CursorTarget["kind"], CursorTarget> = {
    "no-part": { kind: "no-part" },
    "no-column": { kind: "no-column" },
    playable: { kind: "playable", event: notesEvent },
    barline: { kind: "barline", event: barlineEvent },
  };

  const table: Record<Scope, Record<CursorTarget["kind"], boolean>> = {
    "column-property": { "no-part": false, "no-column": false, playable: true, barline: false },
    "next-note": { "no-part": false, "no-column": false, playable: true, barline: false },
    part: { "no-part": false, "no-column": true, playable: true, barline: true },
  };

  for (const scope of Object.keys(table) as Scope[]) {
    for (const kind of Object.keys(targets) as CursorTarget["kind"][]) {
      it(`${scope} × ${kind} = ${table[scope][kind]}`, () => {
        expect(appliesTo(scope, targets[kind])).toBe(table[scope][kind]);
      });
    }
  }
});

describe("targetEvent", () => {
  it("returns the event when the scope applies and the target carries one", () => {
    expect(targetEvent("column-property", { kind: "playable", event: notesEvent })).toBe(
      notesEvent,
    );
    expect(targetEvent("part", { kind: "barline", event: barlineEvent })).toBe(barlineEvent);
  });

  it("returns undefined when the scope does not apply", () => {
    expect(targetEvent("column-property", { kind: "barline", event: barlineEvent })).toBeUndefined();
    expect(targetEvent("next-note", { kind: "no-column" })).toBeUndefined();
  });

  it("returns undefined for a target with no event even when the scope applies", () => {
    expect(targetEvent("part", { kind: "no-column" })).toBeUndefined();
  });
});
