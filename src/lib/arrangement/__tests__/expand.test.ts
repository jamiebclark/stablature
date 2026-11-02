import { describe, expect, it } from "vitest";
import type { ArrangementEntryRow, PartRow } from "../../model";
import {
  describeArrangement,
  expandArrangement,
  parseArrangement,
  totalPasses,
} from "../expand";

let seq = 0;

function entry(overrides: Partial<ArrangementEntryRow>): ArrangementEntryRow {
  seq += 1;
  return {
    id: `entry-${seq}`,
    bandId: "band",
    songId: "song",
    rank: `a${seq}`,
    kind: "part",
    partId: null,
    repeat: 1,
    fromBar: null,
    toBar: null,
    lastRepeatPartId: null,
    label: null,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
    ...overrides,
  };
}

/** Parts named the way a band names them. */
const parts: Pick<PartRow, "id" | "label">[] = [
  { id: "p-a", label: "A" },
  { id: "p-a-prime", label: "A'" },
  { id: "p-b", label: "B" },
  { id: "p-c", label: "C" },
  { id: "p-d", label: "D" },
  { id: "p-e", label: "E" },
];

const part = (partId: string, overrides: Partial<ArrangementEntryRow> = {}) =>
  entry({ kind: "part", partId, ...overrides });

const sectionStart = (label: string, repeat = 1) =>
  entry({ kind: "section_start", label, repeat });
const sectionEnd = () => entry({ kind: "section_end" });

const describe_ = (entries: ArrangementEntryRow[]) =>
  describeArrangement(parseArrangement(entries), parts);

const play = (entries: ArrangementEntryRow[]) =>
  expandArrangement(parseArrangement(entries)).map(
    (step) => parts.find((p) => p.id === step.partId)!.label,
  );

describe("the motivating example", () => {
  it("expresses A x4, B, A x4 with a flourish on the 4th, B", () => {
    // Straight from the brief: this is the form that is unwieldy as linear tab
    // and trivial as an arrangement.
    const entries = [
      part("p-a", { repeat: 4 }),
      part("p-b"),
      part("p-a", { repeat: 4, lastRepeatPartId: "p-a-prime" }),
      part("p-b"),
    ];

    expect(describe_(entries)).toBe("Ax4  B  Ax4 (4th: A')  B");
    expect(play(entries)).toEqual([
      "A", "A", "A", "A",
      "B",
      "A", "A", "A", "A'",
      "B",
    ]);
  });

  it("expresses Ax1, Bx2, half of C, Ax2, D", () => {
    const entries = [
      part("p-a"),
      part("p-b", { repeat: 2 }),
      part("p-c", { fromBar: 1, toBar: 2 }),
      part("p-a", { repeat: 2 }),
      part("p-d"),
    ];
    expect(describe_(entries)).toBe("A  Bx2  C bars 1-2  Ax2  D");
    expect(play(entries)).toEqual(["A", "B", "B", "C", "A", "A", "D"]);
  });
});

describe("repeats", () => {
  it("treats a missing or zero repeat as one pass", () => {
    expect(play([part("p-a", { repeat: 0 })])).toEqual(["A"]);
    expect(play([part("p-a", { repeat: -3 })])).toEqual(["A"]);
  });

  it("numbers passes within an entry", () => {
    const steps = expandArrangement(parseArrangement([part("p-a", { repeat: 3 })]));
    expect(steps.map((s) => s.pass)).toEqual([1, 2, 3]);
    expect(steps.every((s) => s.passes === 3)).toBe(true);
  });

  it("substitutes the variant on the final pass only", () => {
    const steps = expandArrangement(
      parseArrangement([part("p-a", { repeat: 3, lastRepeatPartId: "p-a-prime" })]),
    );
    expect(steps.map((s) => s.partId)).toEqual(["p-a", "p-a", "p-a-prime"]);
  });

  it("substitutes immediately when the repeat is a single pass", () => {
    expect(play([part("p-a", { repeat: 1, lastRepeatPartId: "p-a-prime" })])).toEqual(["A'"]);
  });

  it("keeps every pass pointing at the entry it came from", () => {
    // The roadmap highlights the entry being played, not the part.
    const entries = [part("p-a", { repeat: 2 })];
    const steps = expandArrangement(parseArrangement(entries));
    expect(new Set(steps.map((s) => s.entryId)).size).toBe(1);
    expect(steps[0].entryId).toBe(entries[0].id);
  });
});

describe("bar ranges", () => {
  it("describes closed, open and single-bar ranges", () => {
    expect(describe_([part("p-c", { fromBar: 1, toBar: 2 })])).toBe("C bars 1-2");
    expect(describe_([part("p-c", { fromBar: 3, toBar: null })])).toBe("C from bar 3");
    expect(describe_([part("p-c", { fromBar: null, toBar: 2 })])).toBe("C to bar 2");
    expect(describe_([part("p-c", { fromBar: 2, toBar: 2 })])).toBe("C bar 2");
  });

  it("carries the range through to every pass", () => {
    const steps = expandArrangement(
      parseArrangement([part("p-c", { repeat: 2, fromBar: 1, toBar: 2 })]),
    );
    expect(steps.map((s) => [s.fromBar, s.toBar])).toEqual([
      [1, 2],
      [1, 2],
    ]);
  });
});

describe("sections", () => {
  it("repeats everything inside", () => {
    // Progressive metal: a chorus that is itself a group of parts.
    const entries = [
      sectionStart("Chorus", 2),
      part("p-d"),
      part("p-e", { repeat: 2 }),
      sectionEnd(),
    ];
    expect(describe_(entries)).toBe("{ Chorus x2: D  Ex2 }");
    expect(play(entries)).toEqual(["D", "E", "E", "D", "E", "E"]);
  });

  it("nests", () => {
    const entries = [
      sectionStart("Outer", 2),
      part("p-a"),
      sectionStart("Inner", 2),
      part("p-b"),
      sectionEnd(),
      sectionEnd(),
    ];
    expect(play(entries)).toEqual(["A", "B", "B", "A", "B", "B"]);
  });

  it("records the enclosing section names on each step", () => {
    const steps = expandArrangement(
      parseArrangement([
        sectionStart("Outer", 1),
        sectionStart("Inner", 1),
        part("p-a"),
        sectionEnd(),
        sectionEnd(),
      ]),
    );
    expect(steps[0].sections).toEqual(["Outer", "Inner"]);
  });

  it("closes an unterminated section at the end of the list", () => {
    // Happens constantly: you start a section and the song ends, or you are
    // still mid-capture. It must render, not throw the song away.
    const entries = [sectionStart("Chorus", 2), part("p-d")];
    expect(play(entries)).toEqual(["D", "D"]);
  });

  it("ignores a stray section end", () => {
    expect(play([sectionEnd(), part("p-a"), sectionEnd()])).toEqual(["A"]);
  });

  it("returns to the outer level after a section closes", () => {
    const entries = [
      part("p-a"),
      sectionStart("Chorus", 2),
      part("p-d"),
      sectionEnd(),
      part("p-b"),
    ];
    expect(play(entries)).toEqual(["A", "D", "D", "B"]);
    expect(describe_(entries)).toBe("A  { Chorus x2: D }  B");
  });
});

describe("robustness", () => {
  it("skips a part entry with no part attached", () => {
    // Reachable through a merge: the part was deleted on another device.
    expect(play([part("p-a"), entry({ kind: "part", partId: null })])).toEqual(["A"]);
  });

  it("shows an unknown part reference rather than crashing", () => {
    expect(describe_([part("p-missing")])).toBe("?");
  });

  it("keeps text entries out of the playable sequence", () => {
    const entries = [part("p-a"), entry({ kind: "text", label: "build slowly" }), part("p-b")];
    expect(play(entries)).toEqual(["A", "B"]);
    expect(describe_(entries)).toBe('A  "build slowly"  B');
  });

  it("handles an empty arrangement", () => {
    expect(parseArrangement([])).toEqual([]);
    expect(expandArrangement([])).toEqual([]);
    expect(describeArrangement([], parts)).toBe("");
  });
});

describe("totalPasses", () => {
  it("counts every pass, sections included", () => {
    const entries = [
      part("p-a", { repeat: 4 }),
      sectionStart("Chorus", 2),
      part("p-d"),
      part("p-e", { repeat: 2 }),
      sectionEnd(),
    ];
    expect(totalPasses(parseArrangement(entries))).toBe(10);
  });
});

describe("ordinals", () => {
  it("reads correctly for the counts a band would actually use", () => {
    const cases: [number, string][] = [
      [1, "1st"],
      [2, "2nd"],
      [3, "3rd"],
      [4, "4th"],
      [11, "11th"],
      [12, "12th"],
      [13, "13th"],
      [21, "21st"],
      [22, "22nd"],
    ];
    for (const [repeat, expected] of cases) {
      expect(describe_([part("p-a", { repeat, lastRepeatPartId: "p-a-prime" })])).toContain(
        `(${expected}: A')`,
      );
    }
  });
});
