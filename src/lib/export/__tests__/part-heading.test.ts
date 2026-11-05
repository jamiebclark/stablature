import { describe, expect, it } from "vitest";
import type { PartRow } from "../../model";
import { presetById } from "../../tunings";
import { isPartHeading, songToText } from "../text";

function part(id: string, label: string, overrides: Partial<PartRow> = {}): PartRow {
  return {
    id,
    bandId: "band",
    songId: "song",
    label,
    name: null,
    rank: `a${label}`,
    variantOfPartId: null,
    notes: null,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
    ...overrides,
  };
}

const song = { id: "song", title: "T", bpm: null, notes: null } as never;

/** Headings are the lines that follow a blank line and are followed by a staff row. */
function headings(parts: PartRow[]): string[] {
  const text = songToText({
    song,
    bandName: "Band",
    tuning: presetById("bass5-b")!,
    tuningName: "B Standard",
    parts,
    eventsByPart: {},
    entries: [],
  });
  const lines = text.split("\n");
  return lines.filter(
    (line, i) => i > 0 && lines[i - 1] === "" && parts.some((p) => line.startsWith(p.label)),
  );
}

describe("isPartHeading (INV-010)", () => {
  it.each([
    [[part("a", "A"), part("b", "B")]],
    [[part("a", "A", { name: "main riff" }), part("b", "B", { name: "chorus" }), part("c", "C")]],
    [[part("a", "A", { name: "riff" }), part("b", "B'", { variantOfPartId: "a" }), part("c", "C", { name: "x", variantOfPartId: "a" })]],
  ])("accepts every heading songToText writes", (parts) => {
    const written = headings(parts);
    expect(written.length).toBe(parts.length);
    for (const line of written) expect(isPartHeading(line), line).toBe(true);
  });

  it.each(["", "[Verse]", "A-men", "Amen", "and the night went on", "  A", "A "])(
    "rejects %j",
    (line) => expect(isPartHeading(line)).toBe(false),
  );
});
