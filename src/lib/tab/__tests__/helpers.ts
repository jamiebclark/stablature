import type { EventRow, FretMap } from "../../model";
import { presetById } from "../../tunings";
import { toAscii } from "../ascii";
import type { Density } from "../layout";

export const bass5 = presetById("bass5-b")!; // G D A E B, index 0 = G

let counter = 0;

/** A tab column; `techniques` is keyed by string index. */
export function ev(
  frets: FretMap,
  techniques: Record<string, string[]> = {},
  overrides: Partial<EventRow> = {},
): EventRow {
  counter += 1;
  return {
    id: `event-${counter}`,
    bandId: "band",
    partId: "part",
    rank: `a${counter}`,
    kind: "notes",
    frets,
    techniques: techniques as EventRow["techniques"],
    repeat: 1,
    durationHint: null,
    tupletId: null,
    tupletCount: null,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
    ...overrides,
  };
}

export const barline = () => ev({}, {}, { kind: "barline" });
export const space = () => ev({}, {}, { kind: "rest" });

/** One string's drawn row, e.g. `-5h7-`, without label or bar caps. */
export function rowOf(events: EventRow[], stringIndex: number, density: Density = "expanded") {
  const lines = toAscii({ events, tuning: bass5, density }).split("\n");
  const line = lines[lines.length - bass5.strings.length + stringIndex];
  return line.slice(line.indexOf("|") + 1, line.lastIndexOf("|"));
}

export function allRows(events: EventRow[], density: Density = "expanded"): string[] {
  const lines = toAscii({ events, tuning: bass5, density }).split("\n");
  return lines.slice(lines.length - bass5.strings.length);
}
