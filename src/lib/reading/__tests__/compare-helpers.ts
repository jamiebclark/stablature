import type { AnnotationRow, EventRow, PartRow } from "@/lib/model";
import type { PartInput } from "@/lib/reading/compare";

let serial = 0;

export function row(over: Partial<EventRow>): EventRow {
  return {
    id: `e${++serial}`,
    kind: "notes",
    frets: {},
    techniques: {},
    repeat: 1,
    durationHint: null,
    tupletId: null,
    tupletCount: null,
    groupKind: null,
    ...over,
  } as unknown as EventRow;
}

/** `5 7 8 | 5 7x4`, `[a b c]` for a group. Letters are frets 1..26. Ids are fresh on every call. */
export function events(text: string): EventRow[] {
  const out: EventRow[] = [];
  let group: string | null = null;
  for (const token of text.match(/\[|\]|\||[a-z0-9]+(?:x\d+)?/g) ?? []) {
    if (token === "[") group = `g${++serial}`;
    else if (token === "]") group = null;
    else if (token === "|") out.push(row({ kind: "barline" }));
    else {
      const [value, times] = token.split("x");
      const fret = /^\d+$/.test(value) ? Number(value) : value.charCodeAt(0) - 96;
      out.push(
        row({
          frets: { "0": fret },
          repeat: times ? Number(times) : 1,
          tupletId: group,
          tupletCount: group ? 3 : null,
        }),
      );
    }
  }
  return out;
}

export function part(id: string, label: string, variantOfPartId: string | null = null): PartRow {
  return { id, label, variantOfPartId } as unknown as PartRow;
}

export function input(
  id: string,
  text: string | EventRow[],
  annotations: AnnotationRow[] = [],
  variantOf: string | null = null,
): PartInput {
  return {
    part: part(id, id.toUpperCase(), variantOf),
    events: typeof text === "string" ? events(text) : text,
    annotations,
  };
}
