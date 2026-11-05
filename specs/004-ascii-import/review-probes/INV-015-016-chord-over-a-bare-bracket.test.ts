/**
 * Round 5. INV-015 and INV-016 crossed, and FR-001. reader.md section 2 keeps a digits-only bracket
 * line a candidate until columns exist, so the walk never marks it as a bracket. T078's chord test
 * needs a staff or a marked bracket below it. So a chord above a bare `3` is not tested as a chord
 * at all, and goes on to the staff tests. `Am` then falls through to placement and reads. `D-7`, which
 * INV-015 names, is S3 and becomes a staff row.
 *
 * The text comes from the real `toAscii`, so this is the app's own output. `ascii.ts` draws the bare
 * form when a span is no wider than its label.
 */
import { describe, expect, it } from "vitest";
import { draftPart } from "@/lib/local/clipboard";
import { toAscii } from "@/lib/tab/ascii";
import { parseTab } from "@/lib/tab/parse";
import { presetById } from "@/lib/tunings";

const tuning = presetById("bass4-e")!;

const column = (fret: number, tupletGroup: number | null) => ({
  kind: "notes" as const,
  frets: { "0": fret },
  techniques: {},
  repeat: 1,
  durationHint: null,
  tupletGroup,
  tupletCount: tupletGroup === null ? null : 3,
  groupKind: tupletGroup === null ? null : ("tuplet" as const),
});

function drawn(chord: string) {
  const clipboard = {
    columns: [column(5, 0), column(7, null)],
    annotations: [{ columnIndex: 0, kind: "chord" as const, value: chord }],
  };
  const { events, annotations } = draftPart(clipboard);
  return toAscii({ events, annotations, tuning, density: "expanded" });
}

describe("INV-015 INV-016 a chord above a bare bracket digit, from the real export", () => {
  it.each(["Am", "G7", "D-7", "A-", "C-9", "E-7"])("%s reads back", (chord) => {
    const text = drawn(chord);
    const parsed = parseTab(text);
    const codes = parsed.ok ? [] : parsed.refusals.map((r) => `${r.line} ${r.code}`);
    expect({ text, codes }).toEqual({ text, codes: [] });
    if (!parsed.ok) return;
    expect(parsed.clipboard.annotations.map((a) => a.value)).toEqual([chord]);
    expect(parsed.clipboard.columns[0].tupletCount).toBe(3);
  });
});
